import { describe, expect, it } from 'vitest';

import { Budget, MAX_BUDGET } from '../domain/budget.value-object';
import { optionalBudgetSchema } from '../presentation/schemas/lead-fields.schemas';

describe('Budget', () => {
  it('accepts zero and the maximum', () => {
    expect(Budget.create(0).value).toBe(0);
    expect(Budget.create(MAX_BUDGET).value).toBe(MAX_BUDGET);
  });

  it.each([MAX_BUDGET + 1, 1e10, 1e12])('rejects %s as too large', (n) => {
    expect(() => Budget.create(n)).toThrow(/at most/);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (n) => {
    expect(() => Budget.create(n)).toThrow();
  });
});

describe('optionalBudgetSchema', () => {
  it('gives a field error for a budget over the maximum', () => {
    expect(optionalBudgetSchema.safeParse(1e12).success).toBe(false);
  });

  it('keeps a normal budget and null', () => {
    expect(optionalBudgetSchema.parse(850000)).toBe(850000);
    expect(optionalBudgetSchema.parse(null)).toBeNull();
  });
});
