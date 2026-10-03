export class KilometersDriven {
  private constructor(readonly value: number) {}

  static create(input: number): KilometersDriven {
    if (!Number.isInteger(input) || input < 0) {
      throw new Error('Kilometers driven must be a non-negative integer');
    }
    return new KilometersDriven(input);
  }
}
