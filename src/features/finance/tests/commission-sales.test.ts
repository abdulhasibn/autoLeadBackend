import { describe, expect, it } from 'vitest';

import { saleModelOf } from '../domain/sale-model';
import { setVehicleDealBodySchema } from '../presentation/schemas/vehicle-money.schemas';

describe('sale models (ADR-0017)', () => {
  it('reads consignment and the retired intermediary sale as commission', () => {
    expect(saleModelOf('dealership_purchase')).toBe('purchase');
    expect(saleModelOf('consignment')).toBe('commission');
    expect(saleModelOf('intermediary_sale')).toBe('commission');
    expect(saleModelOf(null)).toBe('purchase');
  });

  it('takes commissionPercent with up to two decimals as basis points', () => {
    expect(setVehicleDealBodySchema.parse({ commissionPercent: 3.5 })).toMatchObject({
      commissionPercent: 350,
      purchaseRate: null,
    });
    expect(setVehicleDealBodySchema.parse({ commissionPercent: 2.25 }).commissionPercent).toBe(225);
    for (const bad of [0, -1, 100.01, 3.555]) {
      expect(setVehicleDealBodySchema.safeParse({ commissionPercent: bad }).success).toBe(false);
    }
  });
});
