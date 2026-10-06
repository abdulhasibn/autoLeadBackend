import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { GetVehicleUseCase } from '../application/use-cases/get-vehicle.use-case';
import type { VehicleReadModel } from '../domain/vehicle.queries';
import { VehicleFrontImages } from '../application/services/vehicle-front-images';
import { FakeClock, FakeObjectStorage, FakeVehicleMediaQueries, FakeVehicleQueries } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const NOW = new Date('2026-10-06T10:00:00.000Z');

const VEHICLE: VehicleReadModel = {
  id: '33333333-3333-4333-8333-333333333333',
  showroomId: 'b0000000-0000-4000-8000-000000000001',
  ownerId: '22222222-2222-4222-8222-222222222222',
  variantId: '44444444-4444-4444-8444-444444444444',
  makeName: 'Hyundai',
  modelName: 'Creta',
  variantName: 'SX',
  year: 2019,
  registrationNumber: 'KA01AB1234',
  fuelType: 'petrol',
  transmission: 'manual',
  kmDriven: 42000,
  numPreviousOwners: 1,
  colour: 'White',
  insuranceValidUntil: null,
  rcStatus: null,
  serviceHistory: null,
  accidentHistory: false,
  loanStatus: null,
  location: null,
  description: null,
  status: 'open',
  soldLeadId: null,
  acquisitionType: 'consignment',
  submittedBy: ADMIN.userId,
  createdAt: '2026-10-03T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
};

describe('GetVehicleUseCase', () => {
  let useCase: GetVehicleUseCase;
  let queries: FakeVehicleQueries;
  let media: FakeVehicleMediaQueries;
  let storage: FakeObjectStorage;

  beforeEach(() => {
    queries = new FakeVehicleQueries();
    queries.seed(VEHICLE);
    media = new FakeVehicleMediaQueries();
    storage = new FakeObjectStorage();
    useCase = new GetVehicleUseCase(
      new VehicleManagementPolicy(),
      queries,
      new VehicleFrontImages(media, storage, new FakeClock(NOW)),
    );
  });

  it('returns a vehicle read model', async () => {
    const result = await useCase.execute(VEHICLE.id, ADMIN);
    expect(result.makeName).toBe('Hyundai');
    expect(result.frontImageUrl).toBeNull();
  });

  it('includes the front photo URL', async () => {
    media.seed({
      id: 'm-front',
      vehicleId: VEHICLE.id,
      storagePath: `${VEHICLE.id}/front.jpg`,
      category: 'front',
      sortOrder: 0,
      uploadedBy: ADMIN.userId,
      uploadedAt: '2026-10-03T00:00:00.000Z',
    });

    const result = await useCase.execute(VEHICLE.id, ADMIN);

    expect(result.frontImageUrl).toBe(`https://storage.example/read/media/${VEHICLE.id}/front.jpg`);
    expect(storage.batchSignCalls).toBe(1);
  });

  it('throws when missing', async () => {
    await expect(
      useCase.execute('55555555-5555-4555-8555-555555555555', ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
