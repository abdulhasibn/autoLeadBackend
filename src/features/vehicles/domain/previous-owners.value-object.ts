export class PreviousOwners {
  private constructor(readonly value: number) {}

  static create(input: number): PreviousOwners {
    if (!Number.isInteger(input) || input < 0 || input > 32767) {
      throw new Error('Previous owners must be an integer between 0 and 32767');
    }
    return new PreviousOwners(input);
  }
}
