import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ListLeadVehicleMatchesUseCase } from '../application/use-cases/list-lead-vehicle-matches.use-case';
import type { MatchableVehicle } from '../domain/matchable-vehicle.port';
import { FakeLeadQueries, FakeMatchableVehicles, leadReadModel } from './fakes';

const SHOWROOM = 'b0000000-0000-4000-8000-000000000001';
const OTHER_SHOWROOM = 'b0000000-0000-4000-8000-000000000002';
const LEAD_ID = '77777777-7777-4777-8777-000000000001';
const MAKE = 'c0000000-0000-4000-8000-000000000001';
const OTHER_MAKE = 'c0000000-0000-4000-8000-000000000009';
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

function vehicle(n: number, overrides: Partial<MatchableVehicle> = {}): MatchableVehicle {
  return {
    id: toVehicleId(`33333333-3333-4333-8333-00000000000${n}`),
    showroomId: SHOWROOM,
    status: 'open',
    makeId: MAKE,
    makeName: 'Hyundai',
    modelId: 'c0000000-0000-4000-8000-000000000002',
    modelName: 'i20',
    variantId: 'c0000000-0000-4000-8000-000000000003',
    variantName: 'Asta',
    year: 2019,
    registrationNumber: `KA01AB000${n}`,
    kmDriven: 40000,
    colour: 'White',
    fuelType: 'petrol',
    transmission: 'manual',
    bodyTypes: ['hatchback'],
    numPreviousOwners: 1,
    listedPrice: 600000,
    ...overrides,
  };
}

const QUERY = { leadId: LEAD_ID, minScore: 60, limit: 10 };

const tail = (m: { vehicle: MatchableVehicle }) => m.vehicle.id.slice(-1);

describe('ListLeadVehicleMatchesUseCase', () => {
  let queries: FakeLeadQueries;
  let vehicles: FakeMatchableVehicles;
  let useCase: ListLeadVehicleMatchesUseCase;

  beforeEach(() => {
    queries = new FakeLeadQueries();
    vehicles = new FakeMatchableVehicles();
    useCase = new ListLeadVehicleMatchesUseCase(new LeadManagementPolicy(), queries, vehicles);
  });

  it('scores the linked vehicle and leaves it out of suggestions', async () => {
    const own = vehicle(1, { status: 'linked' });
    vehicles.seed(own);
    queries.seed(
      leadReadModel({ id: LEAD_ID, vehicleId: own.id, preferredMakeId: MAKE, budget: 650000 }),
    );

    const result = await useCase.execute(QUERY, ADMIN);

    expect(result.linked?.vehicle.id).toBe(own.id);
    expect(result.linked?.match?.score).toBe(100);
    expect(result.suggested).toEqual([]);
  });

  it('suggests linkable vehicles in the showroom above the floor, best first', async () => {
    vehicles.seed(vehicle(1)); // full fit
    vehicles.seed(vehicle(2, { status: 'linked', listedPrice: 680000 })); // a little over budget
    vehicles.seed(vehicle(3, { makeId: OTHER_MAKE })); // wrong make: below the floor
    vehicles.seed(vehicle(4, { status: 'sold' }));
    vehicles.seed(vehicle(5, { status: 'dropped' }));
    vehicles.seed(vehicle(6, { showroomId: OTHER_SHOWROOM }));
    queries.seed(leadReadModel({ id: LEAD_ID, preferredMakeId: MAKE, budget: 650000 }));

    const result = await useCase.execute(QUERY, ADMIN);

    expect(result.linked).toBeNull();
    expect(result.suggested.map(tail)).toEqual(['1', '2']);
    expect(result.truncated).toBe(false);
  });

  it('needs at least two criteria to suggest', async () => {
    vehicles.seed(vehicle(1));
    queries.seed(leadReadModel({ id: LEAD_ID, preferredColours: ['white'] }));

    const result = await useCase.execute(QUERY, ADMIN);

    expect(result.suggested).toEqual([]);
  });

  it('honours minScore and limit', async () => {
    vehicles.seed(vehicle(1, { fuelType: 'diesel' }));
    vehicles.seed(vehicle(2));
    queries.seed(
      leadReadModel({ id: LEAD_ID, preferredMakeId: MAKE, preferredFuelTypes: ['petrol'] }),
    );

    const low = await useCase.execute({ ...QUERY, minScore: 50 }, ADMIN);
    expect(low.suggested.map(tail)).toEqual(['2', '1']);

    const top = await useCase.execute({ ...QUERY, minScore: 50, limit: 1 }, ADMIN);
    expect(top.suggested.map(tail)).toEqual(['2']);
  });

  it('returns no suggestions and an unscored link when the lead has no preference', async () => {
    const own = vehicle(1);
    vehicles.seed(own);
    vehicles.seed(vehicle(2));
    queries.seed(leadReadModel({ id: LEAD_ID, vehicleId: own.id }));

    const result = await useCase.execute(QUERY, ADMIN);

    expect(result.linked).toEqual({ vehicle: own, match: null });
    expect(result.suggested).toEqual([]);
  });

  it("hides another salesperson's lead", async () => {
    queries.seed(leadReadModel({ id: LEAD_ID, preferredMakeId: MAKE }));

    await expect(useCase.execute(QUERY, SALES)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lets a salesperson see their own lead', async () => {
    vehicles.seed(vehicle(1));
    queries.seed(
      leadReadModel({ id: LEAD_ID, assignedTo: SALES_ID, preferredMakeId: MAKE, budget: 600000 }),
    );

    const result = await useCase.execute(QUERY, SALES);

    expect(result.suggested.map(tail)).toEqual(['1']);
  });

  it('rejects an unknown lead', async () => {
    await expect(useCase.execute(QUERY, ADMIN)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects non-staff', async () => {
    await expect(useCase.execute(QUERY, OWNER)).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
