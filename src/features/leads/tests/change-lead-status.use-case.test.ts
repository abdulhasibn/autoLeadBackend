import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { type UserId, toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ChangeLeadStatusUseCase } from '../application/use-cases/change-lead-status.use-case';
import { toContactId } from '../domain/contact-id';
import { InvalidLeadStatusTransitionError } from '../domain/errors/invalid-lead-status-transition.error';
import { Lead } from '../domain/lead.entity';
import { toLeadId } from '../domain/lead-id';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { FakeClock, FakeLeadRepository, FakeVehicleSale } from './fakes';

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
  let vehicleSale: FakeVehicleSale;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    vehicleSale = new FakeVehicleSale();
    repo.seedLead(lead(LEAD_ID, 'new', null, null));
    repo.seedLead(lead(CLOSING_ID, 'booking_confirmed', VEHICLE_ID, SALES.userId));
    useCase = new ChangeLeadStatusUseCase(
      new LeadManagementPolicy(),
      repo,
      vehicleSale,
      new FakeClock(NOW),
    );
  });

  it('moves a new lead to contacted and records the actor', async () => {
    const result = await useCase.execute(
      { leadId: LEAD_ID, status: 'contacted', notes: 'Called back', markVehicleSold: false },
      ADMIN,
    );
    expect(result).toEqual({ status: 'contacted', vehicleMarkedSold: false });
    expect(repo.writes.at(-1)).toEqual({ actorId: ADMIN.userId, statusNotes: 'Called back' });
  });

  it('rejects an invalid jump', async () => {
    await expect(
      useCase.execute(
        { leadId: LEAD_ID, status: 'negotiation', notes: null, markVehicleSold: false },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(InvalidLeadStatusTransitionError);
  });

  it('closes a lead as sold without touching the vehicle by default', async () => {
    const result = await useCase.execute(
      { leadId: CLOSING_ID, status: 'sold', notes: null, markVehicleSold: false },
      ADMIN,
    );
    expect(result).toEqual({ status: 'sold', vehicleMarkedSold: false });
    expect(vehicleSale.sold).toHaveLength(0);
  });

  it('marks the linked vehicle sold when asked', async () => {
    const result = await useCase.execute(
      { leadId: CLOSING_ID, status: 'sold', notes: null, markVehicleSold: true },
      SALES,
    );
    expect(result).toEqual({ status: 'sold', vehicleMarkedSold: true });
    expect(vehicleSale.sold).toEqual([{ vehicleId: VEHICLE_ID, actorId: SALES.userId }]);
  });

  it('rejects markVehicleSold for any status other than sold', async () => {
    await expect(
      useCase.execute(
        { leadId: LEAD_ID, status: 'contacted', notes: null, markVehicleSold: true },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
    expect(repo.writes).toHaveLength(0);
  });

  it('rejects markVehicleSold when the lead has no vehicle', async () => {
    repo.seedLead(lead(CLOSING_ID, 'booking_confirmed', null, null));
    await expect(
      useCase.execute(
        { leadId: CLOSING_ID, status: 'sold', notes: null, markVehicleSold: true },
        ADMIN,
      ),
    ).rejects.toMatchObject({ code: 'LEAD_HAS_NO_VEHICLE' });
  });

  it('leaves the lead unchanged when the vehicle cannot be sold', async () => {
    vehicleSale.failWith = new Error('vehicle is not listed');
    await expect(
      useCase.execute(
        { leadId: CLOSING_ID, status: 'sold', notes: null, markVehicleSold: true },
        ADMIN,
      ),
    ).rejects.toThrow('vehicle is not listed');
    expect(repo.writes).toHaveLength(0);
  });

  it('can be retried after the lead write fails', async () => {
    repo.failNextSave = true;
    const command = { leadId: CLOSING_ID, status: 'sold', notes: null, markVehicleSold: true };
    await expect(useCase.execute(command, ADMIN)).rejects.toThrow('save failed');

    repo.seedLead(lead(CLOSING_ID, 'booking_confirmed', VEHICLE_ID, SALES.userId));
    await expect(useCase.execute(command, ADMIN)).resolves.toEqual({
      status: 'sold',
      vehicleMarkedSold: true,
    });
    expect(vehicleSale.sold).toHaveLength(1);
  });

  it('hides leads that are not assigned to the salesperson', async () => {
    await expect(
      useCase.execute(
        { leadId: LEAD_ID, status: 'contacted', notes: null, markVehicleSold: false },
        SALES,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
