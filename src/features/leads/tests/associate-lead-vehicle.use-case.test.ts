import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { VehicleLinkRefresher } from '../application/services/vehicle-link-refresher';
import { AssociateLeadVehicleUseCase } from '../application/use-cases/associate-lead-vehicle.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { FakeClock, FakeLeadRepository, FakeVehicles } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_VEHICLE_ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-10-03T00:00:00.000Z');

function newLead(vehicleId: VehicleId | null): Lead {
  return Lead.create({
    id: toLeadId(LEAD_ID),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo: null,
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

describe('AssociateLeadVehicleUseCase', () => {
  let useCase: AssociateLeadVehicleUseCase;
  let repo: FakeLeadRepository;
  let vehicles: FakeVehicles;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    vehicles = new FakeVehicles();
    vehicles.seed(toVehicleId(VEHICLE_ID), 'open');
    repo.seedLead(newLead(null));
    useCase = new AssociateLeadVehicleUseCase(
      new LeadManagementPolicy(),
      repo,
      vehicles,
      new VehicleLinkRefresher(repo, vehicles),
      new FakeClock(NOW),
    );
  });

  it('attaches an open vehicle and marks it linked', async () => {
    const result = await useCase.execute({ leadId: LEAD_ID, vehicleId: VEHICLE_ID }, ADMIN);
    expect(result.vehicleId).toBe(VEHICLE_ID);
    expect(repo.leads.get(LEAD_ID)?.vehicleId).toBe(VEHICLE_ID);
    expect(vehicles.statusOf(toVehicleId(VEHICLE_ID))).toBe('linked');
  });

  it('re-opens the previous vehicle when the lead moves to another one', async () => {
    repo.seedLead(newLead(toVehicleId(OTHER_VEHICLE_ID)));
    vehicles.seed(toVehicleId(OTHER_VEHICLE_ID), 'linked');

    await useCase.execute({ leadId: LEAD_ID, vehicleId: VEHICLE_ID }, ADMIN);

    expect(vehicles.statusOf(toVehicleId(OTHER_VEHICLE_ID))).toBe('open');
    expect(vehicles.statusOf(toVehicleId(VEHICLE_ID))).toBe('linked');
  });

  it('rejects a sold or dropped vehicle', async () => {
    vehicles.seed(toVehicleId(VEHICLE_ID), 'sold');
    await expect(
      useCase.execute({ leadId: LEAD_ID, vehicleId: VEHICLE_ID }, ADMIN),
    ).rejects.toMatchObject({ code: 'VEHICLE_NOT_LINKABLE' });
    expect(repo.writes).toHaveLength(0);
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
