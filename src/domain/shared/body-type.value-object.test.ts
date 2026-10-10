import { describe, expect, it } from 'vitest';

import { BodyType } from './body-type.value-object';

describe('BodyType', () => {
  it('normalises case and rejects unknown styles', () => {
    expect(BodyType.create(' SUV ').value).toBe('suv');
    expect(() => BodyType.create('tank')).toThrow();
  });

  it('reads multi-valued catalog cells and skips unknown parts', () => {
    expect(BodyType.parseCatalogList('crossover, suv')).toEqual(['crossover', 'suv']);
    expect(BodyType.parseCatalogList('pick-up, limousine')).toEqual(['pick-up']);
    expect(BodyType.parseCatalogList(null)).toEqual([]);
  });
});
