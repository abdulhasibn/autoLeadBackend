import { describe, expect, it } from 'vitest';

import { listVehiclesQuerySchema } from '../presentation/schemas/list-vehicles.schemas';

describe('listVehiclesQuerySchema', () => {
  it('parses search, catalog, range and multi-value filters', () => {
    const parsed = listVehiclesQuerySchema.parse({
      search: 'creta ka01',
      makeId: '11111111-1111-4111-8111-111111111111',
      yearMin: '2018',
      yearMax: '2022',
      kmMax: '60000',
      fuelType: 'petrol,diesel',
      transmission: 'automatic',
    });

    expect(parsed).toMatchObject({
      search: 'creta ka01',
      makeId: '11111111-1111-4111-8111-111111111111',
      yearMin: 2018,
      yearMax: 2022,
      kmMax: 60000,
      fuelType: ['petrol', 'diesel'],
      transmission: ['automatic'],
    });
  });

  it('rejects an inverted year range', () => {
    expect(listVehiclesQuerySchema.safeParse({ yearMin: '2022', yearMax: '2018' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown fuel type', () => {
    expect(listVehiclesQuerySchema.safeParse({ fuelType: 'petrol,steam' }).success).toBe(false);
  });

  it('rejects a negative km bound', () => {
    expect(listVehiclesQuerySchema.safeParse({ kmMin: '-1' }).success).toBe(false);
  });
});
