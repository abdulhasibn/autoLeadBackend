import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { AssociateLeadVehicleUseCase } from '../application/use-cases/associate-lead-vehicle.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { toLeadId } from '../domain/lead-id';
import { LeadSource } from '../domain/lead-source.value-object';
import { FakeClock, FakeLeadRepository, FakeLiveVehicleLookup } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-03T00:00:00.000Z');

describe('AssociateLeadVehicleUseCase', () => {
  let useCase: AssociateLeadVehicleUseCase;
  let repo: FakeLeadRepository;
  let vehicles: FakeLiveVehicleLookup;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    vehicles = new FakeLiveVehicleLookup();
    vehicles.seed(toVehicleId(VEHICLE_ID));
    repo.seedLead(
      Lead.create({
        id: toLeadId(LEAD_ID),
        showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
        contactId: toContactId('66666666-6666-4666-8666-666666666666'),
        vehicleId: null,
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
      }),
    );
    useCase = new AssociateLeadVehicleUseCase(
      new LeadManagementPolicy(),
      repo,
      vehicles,
      new FakeClock(NOW),
    );
  });

  it('attaches a live vehicle', async () => {
    const result = await useCase.execute({ leadId: LEAD_ID, vehicleId: VEHICLE_ID }, ADMIN);
    expect(result.vehicleId).toBe(VEHICLE_ID);
    expect(repo.leads.get(LEAD_ID)?.vehicleId).toBe(VEHICLE_ID);
  });

  it('rejects a missing vehicle', async () => {
    await expect(
      useCase.execute(
        { leadId: LEAD_ID, vehicleId: '55555555-5555-4555-8555-555555555555' },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
