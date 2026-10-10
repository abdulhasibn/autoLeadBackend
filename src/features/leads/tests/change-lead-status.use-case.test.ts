import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { type UserId, toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { VehicleLinkRefresher } from '../application/services/vehicle-link-refresher';
import { ChangeLeadStatusUseCase } from '../application/use-cases/change-lead-status.use-case';
import { toContactId } from '../domain/contact-id';
import { InvalidLeadStatusTransitionError } from '../domain/errors/invalid-lead-status-transition.error';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { LeadPreference } from '../domain/lead-preference.value-object';
import { FakeClock, FakeLeadRepository, FakeVehicles } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALES: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const CLOSING_ID = '88888888-8888-4888-8888-888888888888';
const RIVAL_ID = '55555555-5555-4555-8555-555555555555';
const PARKED_ID = '44444444-4444-4444-8444-444444444444';
const VEHICLE_ID = toVehicleId('99999999-9999-4999-8999-999999999999');
const NOW = new Date('2026-10-03T00:00:00.000Z');

function lead(
  id: string,
  status: string,
  vehicleId: VehicleId | null,
  assignedTo: UserId | null,
): Lead {
  return Lead.reconstitute({
    id: toLeadId(id),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo,
    source: LeadSource.create('phone'),
    status: LeadStatus.create(status),
    budget: null,
    preferredVehicle: null,
    preference: LeadPreference.none(),
    purchaseTimeline: null,
    financeRequired: null,
    currentVehicle: null,
    tradeInRequired: null,
    notes: null,
    createdBy: ADMIN.userId,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
}

describe('ChangeLeadStatusUseCase', () => {
  let useCase: ChangeLeadStatusUseCase;
  let repo: FakeLeadRepository;
  let vehicles: FakeVehicles;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    vehicles = new FakeVehicles();
    vehicles.seed(VEHICLE_ID, 'linked');
    repo.seedLead(lead(LEAD_ID, 'new', null, null));
    repo.seedLead(lead(CLOSING_ID, 'booking_confirmed', VEHICLE_ID, SALES.userId));
    useCase = new ChangeLeadStatusUseCase(
      new LeadManagementPolicy(),
      repo,
      vehicles,
      new VehicleLinkRefresher(repo, vehicles),
      new FakeClock(NOW),
    );
  });

  it('parks a new lead as not_now and records the actor', async () => {
    const result = await useCase.execute(
      { leadId: LEAD_ID, status: 'not_now', notes: 'Call after Diwali' },
      ADMIN,
    );
    expect(result).toEqual({ status: 'not_now', vehicleSold: false });
    expect(repo.writes.at(-1)).toEqual({ actorId: ADMIN.userId, statusNotes: 'Call after Diwali' });
  });

  it('rejects an invalid jump', async () => {
    await expect(
      useCase.execute({ leadId: CLOSING_ID, status: 'not_now', notes: null }, ADMIN),
    ).rejects.toBeInstanceOf(InvalidLeadStatusTransitionError);
  });

  it('requires a vehicle before booking', async () => {
    await expect(
      useCase.execute({ leadId: LEAD_ID, status: 'booking_confirmed', notes: null }, ADMIN),
    ).rejects.toMatchObject({ code: 'LEAD_REQUIRES_VEHICLE' });
    expect(repo.writes).toHaveLength(0);
  });

  it('rejects vehicle_unavailable as a manual status', async () => {
    await expect(
      useCase.execute({ leadId: LEAD_ID, status: 'vehicle_unavailable', notes: null }, ADMIN),
    ).rejects.toMatchObject({ code: 'LEAD_STATUS_SYSTEM_MANAGED' });
  });

  it('converting sells the vehicle to the lead', async () => {
    const result = await useCase.execute(
      { leadId: CLOSING_ID, status: 'converted', notes: null },
      SALES,
    );
    expect(result).toEqual({ status: 'converted', vehicleSold: true });
    expect(vehicles.statusOf(VEHICLE_ID)).toBe('sold');
    expect(vehicles.soldTo.get(VEHICLE_ID)).toBe(CLOSING_ID);
  });

  it('converting moves the other active leads on the vehicle to vehicle_unavailable', async () => {
    repo.seedLead(lead(RIVAL_ID, 'new', VEHICLE_ID, null));
    repo.seedLead(lead(PARKED_ID, 'not_now', VEHICLE_ID, null));

    await useCase.execute({ leadId: CLOSING_ID, status: 'converted', notes: null }, ADMIN);

    for (const id of [RIVAL_ID, PARKED_ID]) {
      const other = repo.leads.get(id);
      expect(other?.status.value).toBe('vehicle_unavailable');
      expect(other?.vehicleId).toBeNull();
    }
    expect(repo.writes).toContainEqual({
      actorId: ADMIN.userId,
      statusNotes: `Vehicle sold through lead ${CLOSING_ID}`,
    });
  });

  it('leaves every lead unchanged when the vehicle cannot be sold', async () => {
    vehicles.saleError = new Error('vehicle is dropped');
    await expect(
      useCase.execute({ leadId: CLOSING_ID, status: 'converted', notes: null }, ADMIN),
    ).rejects.toThrow('vehicle is dropped');
    expect(repo.writes).toHaveLength(0);
  });

  it('can be retried after the converting lead write fails', async () => {
    repo.seedLead(lead(RIVAL_ID, 'new', VEHICLE_ID, null));
    const command = { leadId: CLOSING_ID, status: 'converted', notes: null };

    repo.failNextSave = true;
    await expect(useCase.execute(command, ADMIN)).rejects.toThrow('save failed');

    repo.seedLead(lead(CLOSING_ID, 'booking_confirmed', VEHICLE_ID, SALES.userId));
    await expect(useCase.execute(command, ADMIN)).resolves.toEqual({
      status: 'converted',
      vehicleSold: true,
    });
    expect(repo.leads.get(RIVAL_ID)?.status.value).toBe('vehicle_unavailable');
    expect(repo.leads.get(CLOSING_ID)?.status.value).toBe('converted');
  });

  it('losing the last active lead re-opens the vehicle', async () => {
    await useCase.execute({ leadId: CLOSING_ID, status: 'lost', notes: null }, ADMIN);
    expect(vehicles.statusOf(VEHICLE_ID)).toBe('open');
  });

  it('keeps the vehicle linked while another active lead remains', async () => {
    repo.seedLead(lead(PARKED_ID, 'not_now', VEHICLE_ID, null));
    await useCase.execute({ leadId: CLOSING_ID, status: 'lost', notes: null }, ADMIN);
    expect(vehicles.statusOf(VEHICLE_ID)).toBe('linked');
  });

  it('revives a vehicle_unavailable lead once it has a new vehicle', async () => {
    const otherVehicle = toVehicleId('12121212-1212-4121-8121-121212121212');
    vehicles.seed(otherVehicle, 'open');
    repo.seedLead(lead(RIVAL_ID, 'vehicle_unavailable', otherVehicle, null));

    await useCase.execute({ leadId: RIVAL_ID, status: 'new', notes: null }, ADMIN);

    expect(repo.leads.get(RIVAL_ID)?.status.value).toBe('new');
    expect(vehicles.statusOf(otherVehicle)).toBe('linked');
  });

  it('hides leads that are not assigned to the salesperson', async () => {
    await expect(
      useCase.execute({ leadId: LEAD_ID, status: 'not_now', notes: null }, SALES),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
