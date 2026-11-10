/**
 * How the business takes the car on (ADR-0017):
 * - `dealership_purchase`: bought outright and resold as our own;
 * - `consignment`: marketed for the owner for a commission.
 */
export const ACQUISITION_TYPES = ['dealership_purchase', 'consignment'] as const;

/** Retired value; rows still holding it read as `consignment`. */
const LEGACY_INTERMEDIARY_SALE = 'intermediary_sale';

export type AcquisitionTypeValue = (typeof ACQUISITION_TYPES)[number];

export class AcquisitionType {
  private constructor(readonly value: AcquisitionTypeValue) {}

  static create(input: string): AcquisitionType {
    const trimmed = input.trim();
    if (!ACQUISITION_TYPES.includes(trimmed as AcquisitionTypeValue)) {
      throw new Error('Acquisition type must be dealership_purchase or consignment');
    }
    return new AcquisitionType(trimmed as AcquisitionTypeValue);
  }

  /** Reads a stored value, mapping the retired `intermediary_sale` to `consignment`. */
  static fromStored(input: string): AcquisitionType {
    return AcquisitionType.create(
      input.trim() === LEGACY_INTERMEDIARY_SALE ? 'consignment' : input,
    );
  }
}
