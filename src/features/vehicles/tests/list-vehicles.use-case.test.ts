import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { ListVehiclesUseCase } from '../application/use-cases/list-vehicles.use-case';
import type { VehicleReadModel } from '../domain/vehicle.queries';
import { FakeVehicleQueries } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
};

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
  status: 'submitted',
  acquisitionType: 'consignment',
  submittedBy: ADMIN.userId,
  createdAt: '2026-10-03T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
};

describe('ListVehiclesUseCase', () => {
  let useCase: ListVehiclesUseCase;
  let queries: FakeVehicleQueries;

  beforeEach(() => {
    queries = new FakeVehicleQueries();
    queries.seed(VEHICLE);
    useCase = new ListVehiclesUseCase(new VehicleManagementPolicy(), queries);
  });

  it('returns a page of vehicles', async () => {
    const page = await useCase.execute({ page: { limit: 20, offset: 0 } }, ADMIN);
    expect(page.total).toBe(1);
    expect(page.items[0]?.registrationNumber).toBe('KA01AB1234');
  });
});
