import { describe, expect, it } from 'vitest';

import { Money } from '../domain/money.value-object';

describe('Money', () => {
  it('converts rupees to paise without floating-point drift', () => {
    expect(Money.fromRupees(545000).paise).toBe(54_500_000);
    expect(Money.fromRupees(0.1).add(Money.fromRupees(0.2)).paise).toBe(30);
    expect(Money.fromRupees(1234.5).rupees).toBe(1234.5);
  });

  it('rejects negatives, fractions of a paisa and non-numbers', () => {
    expect(() => Money.fromRupees(-1)).toThrow();
    expect(() => Money.fromRupees(1.005)).toThrow();
    expect(() => Money.fromRupees(Number.NaN)).toThrow();
    expect(() => Money.ofPaise(1.5)).toThrow();
  });

  it('subtracts, refusing to go below zero; difference may be negative', () => {
    const landing = Money.fromRupees(545000);
    const sale = Money.fromRupees(560000);

    expect(sale.subtract(landing).rupees).toBe(15000);
    expect(() => landing.subtract(sale)).toThrow();
    expect(landing.difference(sale)).toBe(-1_500_000);
  });
});
