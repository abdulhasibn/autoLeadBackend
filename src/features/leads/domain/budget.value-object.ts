/** ₹100 crore. Well inside the `numeric(12,2)` column, which overflows at ₹10,00,00,00,000. */
export const MAX_BUDGET = 1_000_000_000;

export class Budget {
  private constructor(readonly value: number) {}

  static create(input: number): Budget {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error('Budget must be a non-negative number');
    }
    if (input > MAX_BUDGET) {
      throw new Error('Budget must be at most ₹10,00,00,000');
    }
    return new Budget(input);
  }
}
