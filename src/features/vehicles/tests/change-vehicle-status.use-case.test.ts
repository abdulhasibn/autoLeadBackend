import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { ChangeVehicleStatusUseCase } from '../application/use-cases/change-vehicle-status.use-case';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../../../domain/shared/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import { FakeClock, FakeLinkedLeads, FakeVehicleRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-03T00:00:00.000Z');

function seedVehicle(): Vehicle {
  return Vehicle.create({
    id: toVehicleId(VEHICLE_ID),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    ownerId: toOwnerId('22222222-2222-4222-8222-222222222222'),
    variantId: toVariantId('44444444-4444-4444-8444-444444444444'),
    year: VehicleYear.create(2019),
    registrationNumber: RegistrationNumber.create('KA01AB1234'),
    fuelType: FuelType.create('petrol'),
    transmission: Transmission.create('manual'),
    kmDriven: KilometersDriven.create(42000),
    numPreviousOwners: PreviousOwners.create(1),
    colour: 'White',
    insuranceValidUntil: null,
    rcStatus: null,
    serviceHistory: null,
    accidentHistory: false,
    loanStatus: null,
    location: null,
    description: null,
    acquisitionType: AcquisitionType.create('consignment'),
    submittedBy: ADMIN.userId,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('ChangeVehicleStatusUseCase', () => {
  let useCase: ChangeVehicleStatusUseCase;
  let repo: FakeVehicleRepository;
  let linkedLeads: FakeLinkedLeads;

  beforeEach(() => {
    repo = new FakeVehicleRepository();
    repo.seed(seedVehicle());
    linkedLeads = new FakeLinkedLeads();
    useCase = new ChangeVehicleStatusUseCase(
      new VehicleManagementPolicy(),
      repo,
      linkedLeads,
      new FakeClock(NOW),
    );
  });

  const drop = {
    vehicleId: VEHICLE_ID,
    status: 'dropped',
    reason: null,
    confirmUnlinkLeads: false,
  };

  it('drops a vehicle with no active leads', async () => {
    const result = await useCase.execute({ ...drop, reason: 'owner withdrew' }, ADMIN);
    expect(result).toEqual({ status: 'dropped', unlinkedLeadCount: 0 });
    expect(linkedLeads.unlinked).toHaveLength(0);
  });

  it('warns before dropping a vehicle that has active leads', async () => {
    linkedLeads.active.set(VEHICLE_ID, 2);
    repo.saveError = new Error('must not save');
    await expect(useCase.execute(drop, ADMIN)).rejects.toMatchObject({
      code: 'VEHICLE_HAS_LINKED_LEADS',
      details: { linkedLeadCount: 2 },
    });
    expect(linkedLeads.unlinked).toHaveLength(0);
  });

  it('unlinks the leads and drops the vehicle once confirmed', async () => {
    linkedLeads.active.set(VEHICLE_ID, 2);
    const result = await useCase.execute({ ...drop, confirmUnlinkLeads: true }, ADMIN);
    expect(result).toEqual({ status: 'dropped', unlinkedLeadCount: 2 });
    expect(linkedLeads.unlinked).toEqual([VEHICLE_ID]);
  });

  it('re-lists a dropped vehicle', async () => {
    await useCase.execute(drop, ADMIN);
    const result = await useCase.execute({ ...drop, status: 'open' }, ADMIN);
    expect(result.status).toBe('open');
  });

  it('refuses lead-driven statuses', async () => {
    for (const status of ['linked', 'sold']) {
      await expect(useCase.execute({ ...drop, status }, ADMIN)).rejects.toMatchObject({
        code: 'VEHICLE_STATUS_SYSTEM_MANAGED',
      });
    }
  });

  it('throws when the vehicle is missing', async () => {
    await expect(
      useCase.execute({ ...drop, vehicleId: '55555555-5555-4555-8555-555555555555' }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a salesperson', async () => {
    await expect(
      useCase.execute(drop, {
        userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
