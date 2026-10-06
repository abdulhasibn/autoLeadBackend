import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { ListVehiclesUseCase } from '../application/use-cases/list-vehicles.use-case';
import type { VehicleMediaReadModel } from '../domain/vehicle-media.queries';
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

describe('ListVehiclesUseCase', () => {
  let useCase: ListVehiclesUseCase;
  let queries: FakeVehicleQueries;
  let media: FakeVehicleMediaQueries;
  let storage: FakeObjectStorage;

  beforeEach(() => {
    queries = new FakeVehicleQueries();
    queries.seed(VEHICLE);
    media = new FakeVehicleMediaQueries();
    storage = new FakeObjectStorage();
    useCase = new ListVehiclesUseCase(
      new VehicleManagementPolicy(),
      queries,
      new VehicleFrontImages(media, storage, new FakeClock(NOW)),
    );
  });

  it('returns a page of vehicles', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);
    expect(page.total).toBe(1);
    expect(page.items[0]?.registrationNumber).toBe('KA01AB1234');
  });

  it('attaches the lowest-sort front photo as frontImageUrl in one batch', async () => {
    const vehicleId = VEHICLE.id;
    media.seed(mediaItem('m-rear', vehicleId, 'rear', 0, `${vehicleId}/rear.jpg`));
    media.seed(mediaItem('m-front-2', vehicleId, 'front', 2, `${vehicleId}/front-2.jpg`));
    media.seed(mediaItem('m-front-1', vehicleId, 'front', 1, `${vehicleId}/front-1.jpg`));
    queries.seed({ ...VEHICLE, id: OTHER_VEHICLE_ID, registrationNumber: 'KA01AB9999' });

    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);

    const withPhoto = page.items.find((item) => item.id === vehicleId);
    const withoutPhoto = page.items.find((item) => item.id === OTHER_VEHICLE_ID);
    expect(withPhoto?.frontImageUrl).toBe(
      `https://storage.example/read/media/${vehicleId}/front-1.jpg`,
    );
    expect(withPhoto?.frontImageUrlExpiresAt).toBe('2026-10-06T10:10:00.000Z');
    expect(withoutPhoto?.frontImageUrl).toBeNull();
    expect(withoutPhoto?.frontImageUrlExpiresAt).toBeNull();
    expect(storage.batchSignCalls).toBe(1);
  });

  it('returns a null frontImageUrl when the photo cannot be signed', async () => {
    const path = `${VEHICLE.id}/front.jpg`;
    media.seed(mediaItem('m-front', VEHICLE.id, 'front', 0, path));
    storage.unsignable.add(path);

    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);

    expect(page.items[0]?.frontImageUrl).toBeNull();
    expect(page.items[0]?.frontImageUrlExpiresAt).toBeNull();
  });
});

const OTHER_VEHICLE_ID = '55555555-5555-4555-8555-555555555555';

function mediaItem(
  id: string,
  vehicleId: string,
  category: string,
  sortOrder: number,
  storagePath: string,
): VehicleMediaReadModel {
  return {
    id,
    vehicleId,
    storagePath,
    category,
    sortOrder,
    uploadedBy: ADMIN.userId,
    uploadedAt: '2026-10-03T00:00:00.000Z',
  };
}
