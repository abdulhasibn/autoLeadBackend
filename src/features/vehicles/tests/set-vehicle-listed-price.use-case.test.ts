import { describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { SetVehicleListedPriceUseCase } from '../application/use-cases/set-vehicle-listed-price.use-case';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../../../domain/shared/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { IVehicleListedPriceWriter } from '../domain/vehicle-listed-price.port';
import { FakeVehicleRepository } from './fakes';

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

class FakeListedPriceWriter implements IVehicleListedPriceWriter {
  readonly prices = new Map<string, number | null>();

  async set(vehicleId: VehicleId, listedPrice: number | null): Promise<void> {
    this.prices.set(vehicleId, listedPrice);
  }
}

const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

function setup() {
  const repo = new FakeVehicleRepository();
  repo.seed(seedVehicle());
  const writer = new FakeListedPriceWriter();
  return {
    writer,
    useCase: new SetVehicleListedPriceUseCase(new VehicleManagementPolicy(), repo, writer),
  };
}

describe('SetVehicleListedPriceUseCase', () => {
  it('lets an admin set and clear the listed price', async () => {
    const { useCase, writer } = setup();

    await expect(useCase.execute(VEHICLE_ID, 1250000, ADMIN)).resolves.toEqual({
      listedPrice: 1250000,
    });
    expect(writer.prices.get(VEHICLE_ID)).toBe(1250000);

    await useCase.execute(VEHICLE_ID, null, ADMIN);
    expect(writer.prices.get(VEHICLE_ID)).toBeNull();
  });

  it('keeps pricing admin-only', async () => {
    const { useCase, writer } = setup();

    await expect(useCase.execute(VEHICLE_ID, 1250000, SALESPERSON)).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
    expect(writer.prices.size).toBe(0);
  });

  it('answers not found for an unknown vehicle', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute('99999999-9999-4999-8999-999999999999', 100, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
