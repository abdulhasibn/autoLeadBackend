export const FUEL_TYPES = ['petrol', 'diesel', 'cng', 'electric', 'hybrid'] as const;

export type FuelTypeValue = (typeof FUEL_TYPES)[number];

export class FuelType {
  private constructor(readonly value: FuelTypeValue) {}

  static create(input: string): FuelType {
    const trimmed = input.trim();
    if (!FUEL_TYPES.includes(trimmed as FuelTypeValue)) {
      throw new Error('Fuel type must be petrol, diesel, cng, electric, or hybrid');
    }
    return new FuelType(trimmed as FuelTypeValue);
  }
}
