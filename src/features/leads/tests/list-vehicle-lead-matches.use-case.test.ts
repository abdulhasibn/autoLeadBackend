import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ListVehicleLeadMatchesUseCase } from '../application/use-cases/list-vehicle-lead-matches.use-case';
import type { MatchableVehicle } from '../domain/matchable-vehicle.port';
import { FakeLeadQueries, FakeMatchableVehicles, leadReadModel } from './fakes';

const SHOWROOM = 'b0000000-0000-4000-8000-000000000001';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const MAKE = 'c0000000-0000-4000-8000-000000000001';
const MODEL = 'c0000000-0000-4000-8000-000000000002';
const SALES_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const SALES: AuthenticatedContext = {
  userId: toUserId(SALES_ID),
  roles: ['salesperson'],
  showroomId: null,
};

const OWNER: AuthenticatedContext = {
  userId: toUserId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  roles: ['owner'],
  showroomId: null,
};

const VEHICLE: MatchableVehicle = {
  id: toVehicleId(VEHICLE_ID),
  showroomId: SHOWROOM,
  status: 'open',
  makeId: MAKE,
  makeName: 'Hyundai',
  modelId: MODEL,
  modelName: 'i20',
  variantId: 'c0000000-0000-4000-8000-000000000003',
  variantName: 'Asta',
  year: 2019,
  registrationNumber: 'KA01AB1234',
  kmDriven: 40000,
  colour: 'White',
  fuelType: 'petrol',
  transmission: 'manual',
  bodyTypes: ['hatchback'],
  numPreviousOwners: 1,
  listedPrice: 600000,
};

const QUERY = { vehicleId: VEHICLE_ID, minScore: 60, limit: 10 };

function lead(n: number, overrides: Parameters<typeof leadReadModel>[0] = {}) {
  return leadReadModel({ id: `77777777-7777-4777-8777-00000000000${n}`, ...overrides });
}

describe('ListVehicleLeadMatchesUseCase', () => {
  let queries: FakeLeadQueries;
  let vehicles: FakeMatchableVehicles;
  let useCase: ListVehicleLeadMatchesUseCase;

  beforeEach(() => {
    queries = new FakeLeadQueries();
    vehicles = new FakeMatchableVehicles();
    vehicles.seed(VEHICLE);
    useCase = new ListVehicleLeadMatchesUseCase(new LeadManagementPolicy(), queries, vehicles);
  });

  it('scores linked leads, best first, with unscorable ones last', async () => {
    queries.seed(lead(1, { vehicleId: VEHICLE_ID }));
    queries.seed(lead(2, { vehicleId: VEHICLE_ID, preferredFuelTypes: ['diesel'] }));
    queries.seed(
      lead(3, { vehicleId: VEHICLE_ID, preferredMakeId: MAKE, preferredModelId: MODEL }),
    );

    const result = await useCase.execute(QUERY, ADMIN);

    expect(result.vehicle.id).toBe(VEHICLE_ID);
    expect(result.linked.map((l) => [l.id.slice(-1), l.match?.score ?? null])).toEqual([
      ['3', 100],
      ['2', 0],
      ['1', null],
    ]);
  });

  it('suggests open unlinked leads above the score floor with at least two criteria', async () => {
    queries.seed(lead(1, { preferredMakeId: MAKE, budget: 650000, preferredColours: ['white'] }));
    // One criterion only: a 100% colour match is not enough to suggest.
    queries.seed(lead(2, { preferredColours: ['white'] }));
    // Below the floor.
    queries.seed(lead(3, { preferredFuelTypes: ['diesel'], preferredTransmissions: ['manual'] }));
    // Closed, linked elsewhere, or in another showroom: not candidates.
    queries.seed(lead(4, { status: 'lost', preferredMakeId: MAKE, budget: 650000 }));
    queries.seed(
      lead(5, {
        vehicleId: '44444444-4444-4444-8444-444444444444',
        preferredMakeId: MAKE,
        budget: 650000,
      }),
    );
    queries.seed(
      lead(6, {
        showroomId: 'b0000000-0000-4000-8000-000000000002',
        preferredMakeId: MAKE,
        budget: 650000,
      }),
    );
    // Parked after another buyer took its car: still shopping.
    queries.seed(lead(7, { status: 'vehicle_unavailable', preferredKmMax: 45000, budget: 640000 }));

    const result = await useCase.execute(QUERY, ADMIN);

    expect(result.suggested.map((l) => l.id.slice(-1))).toEqual(['1', '7']);
    expect(result.linked).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('honours minScore and limit', async () => {
    queries.seed(lead(1, { preferredMakeId: MAKE, preferredFuelTypes: ['diesel'] }));
    queries.seed(lead(2, { preferredMakeId: MAKE, preferredFuelTypes: ['petrol'] }));

    const low = await useCase.execute({ ...QUERY, minScore: 50 }, ADMIN);
    expect(low.suggested.map((l) => l.id.slice(-1))).toEqual(['2', '1']);

    const top = await useCase.execute({ ...QUERY, minScore: 50, limit: 1 }, ADMIN);
    expect(top.suggested.map((l) => l.id.slice(-1))).toEqual(['2']);
  });

  it('shows a salesperson only their own leads', async () => {
    queries.seed(lead(1, { vehicleId: VEHICLE_ID, assignedTo: SALES_ID }));
    queries.seed(lead(2, { vehicleId: VEHICLE_ID }));
    queries.seed(lead(3, { assignedTo: SALES_ID, preferredMakeId: MAKE, budget: 600000 }));
    queries.seed(lead(4, { preferredMakeId: MAKE, budget: 600000 }));

    const result = await useCase.execute(QUERY, SALES);

    expect(result.linked.map((l) => l.id.slice(-1))).toEqual(['1']);
    expect(result.suggested.map((l) => l.id.slice(-1))).toEqual(['3']);
  });

  it('rejects an unknown vehicle', async () => {
    await expect(
      useCase.execute({ ...QUERY, vehicleId: '99999999-9999-4999-8999-999999999999' }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects non-staff', async () => {
    await expect(useCase.execute(QUERY, OWNER)).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
