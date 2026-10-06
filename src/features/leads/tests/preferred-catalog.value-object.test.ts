import { describe, expect, it } from 'vitest';

import { PreferredCatalog } from '../domain/preferred-catalog.value-object';

describe('PreferredCatalog', () => {
  it('accepts a make alone, a make with a model, or a full chain', () => {
    expect(PreferredCatalog.create({ makeId: 'mk', modelId: null, variantId: null }).makeId).toBe(
      'mk',
    );
    expect(
      PreferredCatalog.create({ makeId: 'mk', modelId: 'md', variantId: 'vr' }).variantId,
    ).toBe('vr');
  });

  it('rejects a variant without its model', () => {
    expect(() => PreferredCatalog.create({ makeId: 'mk', modelId: null, variantId: 'vr' })).toThrow(
      'needs its model',
    );
  });

  it('rejects a model without its make', () => {
    expect(() => PreferredCatalog.create({ makeId: null, modelId: 'md', variantId: null })).toThrow(
      'needs its make',
    );
  });

  it('is empty when no make is set', () => {
    expect(PreferredCatalog.none().isEmpty).toBe(true);
  });

  it('compares by value', () => {
    const a = PreferredCatalog.create({ makeId: 'mk', modelId: 'md', variantId: null });
    const b = PreferredCatalog.create({ makeId: 'mk', modelId: 'md', variantId: null });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(PreferredCatalog.none())).toBe(false);
  });
});
