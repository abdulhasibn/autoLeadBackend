export const VEHICLE_STATUSES = [
  'submitted',
  'inspection_pending',
  'under_inspection',
  'approved',
  'available',
  'reserved',
  'sold',
  'rejected',
  'on_hold',
  'removed',
] as const;

export type VehicleStatusValue = (typeof VEHICLE_STATUSES)[number];

export class VehicleStatus {
  private constructor(readonly value: VehicleStatusValue) {}

  static create(input: string): VehicleStatus {
    const trimmed = input.trim();
    if (!VEHICLE_STATUSES.includes(trimmed as VehicleStatusValue)) {
      throw new Error('Invalid vehicle status');
    }
    return new VehicleStatus(trimmed as VehicleStatusValue);
  }

  static submitted(): VehicleStatus {
    return new VehicleStatus('submitted');
  }
}
