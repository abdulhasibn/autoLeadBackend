import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { UpdateVehicleUseCase } from '../application/use-cases/update-vehicle.use-case';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../../../domain/shared/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import { FakeClock, FakeVehicleRepository } from './fakes';

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

describe('UpdateVehicleUseCase', () => {
  let useCase: UpdateVehicleUseCase;
  let repo: FakeVehicleRepository;

  beforeEach(() => {
    repo = new FakeVehicleRepository();
    repo.seed(seedVehicle());
    useCase = new UpdateVehicleUseCase(
      new VehicleManagementPolicy(),
      repo,
      new FakeClock(new Date('2026-10-03T12:00:00.000Z')),
    );
  });

  it('updates second-hand details', async () => {
    const result = await useCase.execute(
      {
        vehicleId: VEHICLE_ID,
        year: 2020,
        registrationNumber: 'KA01AB9999',
        fuelType: 'diesel',
        transmission: 'automatic',
        kmDriven: 50000,
        numPreviousOwners: 2,
        colour: 'Black',
        insuranceValidUntil: null,
        rcStatus: null,
        serviceHistory: null,
        accidentHistory: true,
        loanStatus: null,
        location: null,
        description: null,
      },
      ADMIN,
    );
    expect(result.year).toBe(2020);
    expect(result.registrationNumber).toBe('KA01AB9999');
    expect(result.accidentHistory).toBe(true);
  });

  it('throws when the vehicle is missing', async () => {
    await expect(
      useCase.execute(
        {
          vehicleId: '55555555-5555-4555-8555-555555555555',
          year: 2020,
          registrationNumber: 'KA01AB9999',
          fuelType: 'diesel',
          transmission: 'automatic',
          kmDriven: 1,
          numPreviousOwners: 0,
          colour: 'Black',
          insuranceValidUntil: null,
          rcStatus: null,
          serviceHistory: null,
          accidentHistory: false,
          loanStatus: null,
          location: null,
          description: null,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
