import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import type { SuggestVehiclesQuery } from '../application/dtos/suggest-vehicles.dto';
import { SuggestVehiclesUseCase } from '../application/use-cases/suggest-vehicles.use-case';
import type { MatchableVehicle } from '../domain/matchable-vehicle.port';
import { FakeCatalogLineage, FakeMatchableVehicles } from './fakes';

const SHOWROOM = 'b0000000-0000-4000-8000-000000000001';
const MAKE = 'c0000000-0000-4000-8000-000000000001';
const MODEL = 'c0000000-0000-4000-8000-000000000002';
const VARIANT = 'c0000000-0000-4000-8000-000000000003';
const OTHER_MAKE = 'c0000000-0000-4000-8000-000000000009';
const OTHER_MODEL = 'c0000000-0000-4000-8000-00000000000a';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

function vehicle(overrides: Partial<MatchableVehicle> = {}): MatchableVehicle {
  return {
    id: toVehicleId('33333333-3333-4333-8333-000000000001'),
    showroomId: SHOWROOM,
    status: 'open',
    makeId: MAKE,
    makeName: 'Hyundai',
    modelId: MODEL,
    modelName: 'i20',
    variantId: VARIANT,
    variantName: 'Asta',
    year: 2020,
    registrationNumber: 'KA01AB0001',
    kmDriven: 30000,
    colour: 'White',
    fuelType: 'petrol',
    transmission: 'manual',
    bodyTypes: ['hatchback'],
    numPreviousOwners: 1,
    listedPrice: 650000,
    ...overrides,
  };
}

function query(overrides: Partial<SuggestVehiclesQuery> = {}): SuggestVehiclesQuery {
  return {
    showroomId: SHOWROOM,
    budget: 900000,
    preferredMakeId: null,
    preferredModelId: null,
    preferredVariantId: null,
    preferredColours: [],
    preferredFuelTypes: ['petrol'],
    preferredTransmissions: [],
    preferredBodyTypes: [],
    preferredYearMin: 2015,
    preferredKmMax: null,
    preferredMaxOwners: null,
    minScore: 0,
    limit: 10,
    ...overrides,
  };
}

describe('SuggestVehiclesUseCase', () => {
  let vehicles: FakeMatchableVehicles;
  let catalog: FakeCatalogLineage;
  let useCase: SuggestVehiclesUseCase;

  beforeEach(() => {
    vehicles = new FakeMatchableVehicles();
    catalog = new FakeCatalogLineage();
    catalog.seed(MAKE, MODEL, VARIANT);
    catalog.seed(OTHER_MAKE, OTHER_MODEL);
    vehicles.seed(vehicle());
    useCase = new SuggestVehiclesUseCase(new LeadManagementPolicy(), vehicles, catalog);
  });

  it('scores a model-only pick against its make, like the saved lead', async () => {
    // The wizard sends only the narrowest pick. A car of another make must
    // miss the catalog criterion, not skip it.
    const result = await useCase.execute(query({ preferredModelId: OTHER_MODEL }), ADMIN);

    const [first] = result.suggestions;
    const catalogResult = first?.match?.breakdown.find((b) => b.criterion === 'catalog');
    expect(catalogResult?.outcome).toBe('miss');
    expect(first?.match?.score).toBeLessThan(100);
  });

  it('gives a full match for the same model sent without its make', async () => {
    const result = await useCase.execute(query({ preferredModelId: MODEL }), ADMIN);

    expect(result.suggestions[0]?.match?.score).toBe(100);
  });

  it('rejects an unknown model', async () => {
    await expect(
      useCase.execute(query({ preferredModelId: 'c0000000-0000-4000-8000-0000000000ff' }), ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
