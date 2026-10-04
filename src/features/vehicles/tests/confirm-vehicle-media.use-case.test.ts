import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { ConfirmVehicleMediaUseCase } from '../application/use-cases/confirm-vehicle-media.use-case';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../domain/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../domain/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import {
  FakeClock,
  FakeIdGenerator,
  FakeObjectStorage,
  FakeVehicleMediaRepository,
  FakeVehicleRepository,
} from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_ID = '55555555-5555-4555-8555-555555555555';
const STORAGE_PATH = `${VEHICLE_ID}/${OBJECT_ID}.jpg`;
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

describe('ConfirmVehicleMediaUseCase', () => {
  let useCase: ConfirmVehicleMediaUseCase;
  let vehicles: FakeVehicleRepository;
  let media: FakeVehicleMediaRepository;
  let storage: FakeObjectStorage;
  let ids: FakeIdGenerator;

  beforeEach(() => {
    vehicles = new FakeVehicleRepository();
    media = new FakeVehicleMediaRepository();
    storage = new FakeObjectStorage();
    ids = new FakeIdGenerator();
    vehicles.seed(seedVehicle());
    storage.seed('media', STORAGE_PATH);
    useCase = new ConfirmVehicleMediaUseCase(
      new VehicleManagementPolicy(),
      vehicles,
      media,
      storage,
      new FakeClock(NOW),
      ids,
    );
  });

  it('confirms an uploaded photo', async () => {
    const result = await useCase.execute(
      { vehicleId: VEHICLE_ID, storagePath: STORAGE_PATH, category: 'front', sortOrder: 0 },
      ADMIN,
    );
    expect(result.id).toBe(ids.nextId);
    expect(result.category).toBe('front');
    expect(result.url).toContain(STORAGE_PATH);
    expect(media.store.has(ids.nextId)).toBe(true);
  });

  it('throws when the stored object is missing', async () => {
    await expect(
      useCase.execute(
        {
          vehicleId: VEHICLE_ID,
          storagePath: `${VEHICLE_ID}/66666666-6666-4666-8666-666666666666.jpg`,
          category: 'front',
          sortOrder: 0,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws when the vehicle is missing', async () => {
    await expect(
      useCase.execute(
        {
          vehicleId: '77777777-7777-4777-8777-777777777777',
          storagePath: STORAGE_PATH,
          category: 'front',
          sortOrder: 0,
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
