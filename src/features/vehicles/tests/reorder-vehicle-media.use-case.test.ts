import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { ReorderVehicleMediaUseCase } from '../application/use-cases/reorder-vehicle-media.use-case';
import { MediaCategory } from '../domain/media-category.value-object';
import { toMediaId } from '../domain/media-id';
import { VehicleMedia } from '../domain/vehicle-media.entity';
import { VehicleObjectPath } from '../domain/vehicle-object-path.value-object';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../../../domain/shared/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import { FakeVehicleMediaRepository, FakeVehicleRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const A = '55555555-5555-4555-8555-555555555551';
const B = '55555555-5555-4555-8555-555555555552';
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

function photo(id: string, category: string, sortOrder: number): VehicleMedia {
  return VehicleMedia.create({
    id: toMediaId(id),
    vehicleId: toVehicleId(VEHICLE_ID),
    storagePath: VehicleObjectPath.create(toVehicleId(VEHICLE_ID), `${VEHICLE_ID}/${id}.jpg`),
    category: MediaCategory.create(category),
    sortOrder,
    uploadedBy: ADMIN.userId,
    uploadedAt: NOW,
  });
}

describe('ReorderVehicleMediaUseCase', () => {
  let useCase: ReorderVehicleMediaUseCase;
  let media: FakeVehicleMediaRepository;

  beforeEach(() => {
    const vehicles = new FakeVehicleRepository();
    media = new FakeVehicleMediaRepository();
    vehicles.seed(seedVehicle());
    media.seed(photo(A, 'front', 0));
    media.seed(photo(B, 'other', 1));
    useCase = new ReorderVehicleMediaUseCase(new VehicleManagementPolicy(), vehicles, media);
  });

  it('swaps two photos between slots', async () => {
    await useCase.execute(
      VEHICLE_ID,
      [
        { id: A, category: 'other', sortOrder: 1 },
        { id: B, category: 'front', sortOrder: 0 },
      ],
      ADMIN,
    );
    expect(media.store.get(A)?.category.value).toBe('other');
    expect(media.store.get(B)?.category.value).toBe('front');
    expect(media.store.get(B)?.sortOrder).toBe(0);
  });

  it('changes nothing when one id is unknown', async () => {
    await expect(
      useCase.execute(
        VEHICLE_ID,
        [
          { id: A, category: 'rear', sortOrder: 0 },
          { id: '66666666-6666-4666-8666-666666666666', category: 'front', sortOrder: 1 },
        ],
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(media.store.get(A)?.category.value).toBe('front');
  });
});
