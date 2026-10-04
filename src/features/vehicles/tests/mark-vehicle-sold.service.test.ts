import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { MarkVehicleSoldService } from '../application/services/mark-vehicle-sold.service';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { InvalidVehicleStatusTransitionError } from '../domain/errors/invalid-vehicle-status-transition.error';
import { FuelType } from '../domain/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../domain/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleStatus } from '../domain/vehicle-status.value-object';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import { FakeClock, FakeVehicleRepository } from './fakes';

const VEHICLE_ID = toVehicleId('33333333-3333-4333-8333-333333333333');
const ACTOR = toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const NOW = new Date('2026-10-03T00:00:00.000Z');

function vehicleAt(path: readonly string[]): Vehicle {
  const vehicle = Vehicle.create({
    id: VEHICLE_ID,
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
    submittedBy: ACTOR,
    createdAt: NOW,
    updatedAt: NOW,
  });
  for (const status of path) {
    vehicle.changeStatus(VehicleStatus.create(status), NOW, null);
  }
  return vehicle;
}

const TO_RESERVED = [
  'inspection_pending',
  'under_inspection',
  'approved',
  'available',
  'reserved',
] as const;

describe('MarkVehicleSoldService', () => {
  let repo: FakeVehicleRepository;
  let service: MarkVehicleSoldService;

  beforeEach(() => {
    repo = new FakeVehicleRepository();
    service = new MarkVehicleSoldService(repo, new FakeClock(NOW));
  });

  it('sells a reserved vehicle and records the reason', async () => {
    repo.seed(vehicleAt(TO_RESERVED));
    await service.markSold(VEHICLE_ID, ACTOR, 'Sold through lead 1');
    const saved = await repo.findById(VEHICLE_ID);
    expect(saved?.status.value).toBe('sold');
    expect(saved?.statusChangeReason).toBe('Sold through lead 1');
  });

  it('is a no-op for a vehicle that is already sold', async () => {
    repo.seed(vehicleAt([...TO_RESERVED, 'sold']));
    repo.saveError = new Error('should not save');
    await expect(service.markSold(VEHICLE_ID, ACTOR, 'again')).resolves.toBeUndefined();
  });

  it('refuses a vehicle that is not listed yet', async () => {
    repo.seed(vehicleAt(['inspection_pending']));
    await expect(service.markSold(VEHICLE_ID, ACTOR, 'x')).rejects.toBeInstanceOf(
      InvalidVehicleStatusTransitionError,
    );
  });

  it('reports a missing vehicle', async () => {
    await expect(service.markSold(VEHICLE_ID, ACTOR, 'x')).rejects.toBeInstanceOf(NotFoundError);
  });
});
