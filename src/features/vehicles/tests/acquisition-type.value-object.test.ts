import { describe, expect, it } from 'vitest';

import { AcquisitionType } from '../domain/acquisition-type.value-object';

describe('AcquisitionType', () => {
  it('accepts only the two sale models (ADR-0017)', () => {
    expect(AcquisitionType.create('dealership_purchase').value).toBe('dealership_purchase');
    expect(AcquisitionType.create('consignment').value).toBe('consignment');
    expect(() => AcquisitionType.create('intermediary_sale')).toThrow();
  });

  it('reads stored intermediary sales as consignment', () => {
    expect(AcquisitionType.fromStored('intermediary_sale').value).toBe('consignment');
    expect(AcquisitionType.fromStored('consignment').value).toBe('consignment');
  });
});
