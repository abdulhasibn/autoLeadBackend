export class Budget {
  private constructor(readonly value: number) {}

  static create(input: number): Budget {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error('Budget must be a non-negative number');
    }
    return new Budget(input);
  }
}
