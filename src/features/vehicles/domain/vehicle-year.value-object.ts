export class VehicleYear {
  private constructor(readonly value: number) {}

  static create(input: number): VehicleYear {
    if (!Number.isInteger(input) || input < 1900 || input > 2100) {
      throw new Error('Year must be an integer between 1900 and 2100');
    }
    return new VehicleYear(input);
  }
}
