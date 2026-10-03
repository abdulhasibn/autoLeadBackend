export const ACQUISITION_TYPES = [
  'dealership_purchase',
  'consignment',
  'intermediary_sale',
] as const;

export type AcquisitionTypeValue = (typeof ACQUISITION_TYPES)[number];

export class AcquisitionType {
  private constructor(readonly value: AcquisitionTypeValue) {}

  static create(input: string): AcquisitionType {
    const trimmed = input.trim();
    if (!ACQUISITION_TYPES.includes(trimmed as AcquisitionTypeValue)) {
      throw new Error(
        'Acquisition type must be dealership_purchase, consignment, or intermediary_sale',
      );
    }
    return new AcquisitionType(trimmed as AcquisitionTypeValue);
  }
}
