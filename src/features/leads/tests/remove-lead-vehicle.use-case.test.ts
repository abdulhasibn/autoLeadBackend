import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { type UserId, toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { VehicleLinkRefresher } from '../application/services/vehicle-link-refresher';
import { RemoveLeadVehicleUseCase } from '../application/use-cases/remove-lead-vehicle.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { FakeClock, FakeLeadRepository, FakeVehicles } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_LEAD_ID = '88888888-8888-4888-8888-888888888888';
const VEHICLE_ID = toVehicleId('33333333-3333-4333-8333-333333333333');
const NOW = new Date('2026-10-08T00:00:00.000Z');

function newLead(id: string, vehicleId: VehicleId | null, assignedTo: UserId | null = null): Lead {
  return Lead.create({
    id: toLeadId(id),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo,
    source: LeadSource.create('walkin'),
    budget: null,
    preferredVehicle: null,
    purchaseTimeline: null,
    financeRequired: null,
    currentVehicle: null,
    tradeInRequired: null,
    notes: null,
    createdBy: ADMIN.userId,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('RemoveLeadVehicleUseCase', () => {
  let useCase: RemoveLeadVehicleUseCase;
  let repo: FakeLeadRepository;
  let vehicles: FakeVehicles;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    vehicles = new FakeVehicles();
    vehicles.seed(VEHICLE_ID, 'linked');
    repo.seedLead(newLead(LEAD_ID, VEHICLE_ID));
    useCase = new RemoveLeadVehicleUseCase(
      new LeadManagementPolicy(),
      repo,
      new VehicleLinkRefresher(repo, vehicles),
      new FakeClock(NOW),
    );
  });

  it('clears the link and re-opens the vehicle when no other lead holds it', async () => {
    await expect(useCase.execute(LEAD_ID, ADMIN)).resolves.toEqual({ vehicleId: null });
    expect(repo.leads.get(LEAD_ID)?.vehicleId).toBeNull();
    expect(vehicles.statusOf(VEHICLE_ID)).toBe('open');
  });

  it('keeps the vehicle linked while another active lead holds it', async () => {
    repo.seedLead(newLead(OTHER_LEAD_ID, VEHICLE_ID));

    await useCase.execute(LEAD_ID, ADMIN);

    expect(vehicles.statusOf(VEHICLE_ID)).toBe('linked');
  });

  it('is a no-op without a vehicle', async () => {
    repo.seedLead(newLead(LEAD_ID, null));
    await expect(useCase.execute(LEAD_ID, ADMIN)).resolves.toEqual({ vehicleId: null });
    expect(repo.writes).toHaveLength(0);
  });

  it('refuses a booked lead', async () => {
    const lead = newLead(LEAD_ID, VEHICLE_ID);
    lead.changeStatus(LeadStatus.create('booking_confirmed'), NOW);
    repo.seedLead(lead);

    await expect(useCase.execute(LEAD_ID, ADMIN)).rejects.toMatchObject({
      code: 'LEAD_REQUIRES_VEHICLE',
    });
    expect(vehicles.statusOf(VEHICLE_ID)).toBe('linked');
  });

  it("hides another salesperson's lead", async () => {
    await expect(useCase.execute(LEAD_ID, SALESPERSON)).rejects.toBeInstanceOf(NotFoundError);
  });
});
