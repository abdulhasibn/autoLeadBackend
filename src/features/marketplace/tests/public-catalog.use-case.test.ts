import { describe, expect, it } from 'vitest';

import { GetPublicCatalogUseCase } from '../application/use-cases/get-public-catalog.use-case';
import type { PublicVariantReadModel } from '../domain/public-catalog.queries';
import {
  publicMakeIdParamSchema,
  publicModelIdParamSchema,
} from '../presentation/schemas/public-marketplace.schemas';
import { FakePublicCatalogQueries } from './fakes';

const variant = (name: string): PublicVariantReadModel => ({
  id: `id-${name}`,
  name,
  fuelType: 'petrol',
  transmission: 'manual',
});

describe('GetPublicCatalogUseCase', () => {
  it('lists makes and a make’s models', async () => {
    const queries = new FakePublicCatalogQueries();
    const useCase = new GetPublicCatalogUseCase(queries);

    expect(await useCase.makes()).toEqual([{ id: 'make-1', name: 'Maruti Suzuki' }]);
    expect(await useCase.models('make-1')).toEqual([{ id: 'model-1', name: 'Swift' }]);
    expect(queries.requested).toEqual(['make-1']);
  });

  it('hides the NA placeholder variant', async () => {
    const useCase = new GetPublicCatalogUseCase(
      new FakePublicCatalogQueries([variant('VXi'), variant('NA'), variant('na')]),
    );

    expect((await useCase.variants('model-1')).map((v) => v.name)).toEqual(['VXi']);
  });
});

describe('catalog route params', () => {
  it('accept UUIDs only', () => {
    const uuid = '44444444-4444-4444-8444-444444444444';
    expect(publicMakeIdParamSchema.safeParse({ makeId: uuid }).success).toBe(true);
    expect(publicMakeIdParamSchema.safeParse({ makeId: 'swift' }).success).toBe(false);
    expect(publicModelIdParamSchema.safeParse({ modelId: uuid }).success).toBe(true);
    expect(publicModelIdParamSchema.safeParse({ modelId: '1; drop' }).success).toBe(false);
  });
});
