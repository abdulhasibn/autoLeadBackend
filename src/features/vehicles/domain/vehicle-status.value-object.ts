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

const TERMINAL: readonly VehicleStatusValue[] = ['sold', 'rejected', 'removed'];

const ALLOWED: Readonly<Record<VehicleStatusValue, readonly VehicleStatusValue[]>> = {
  submitted: ['inspection_pending', 'rejected', 'on_hold', 'removed'],
  inspection_pending: ['under_inspection', 'rejected', 'on_hold', 'removed'],
  under_inspection: ['approved', 'rejected', 'on_hold', 'removed'],
  approved: ['available', 'rejected', 'on_hold', 'removed'],
  available: ['reserved', 'sold', 'on_hold', 'removed'],
  reserved: ['available', 'sold'],
  sold: [],
  rejected: [],
  on_hold: ['inspection_pending', 'under_inspection', 'approved', 'available', 'removed'],
  removed: [],
};

export class VehicleStatus {
  private constructor(readonly value: VehicleStatusValue) {}

  static create(input: string): VehicleStatus {
    const trimmed = input.trim();
    if (!VEHICLE_STATUSES.includes(trimmed as VehicleStatusValue)) {
      throw new Error('Invalid vehicle status');
    }
    return new VehicleStatus(trimmed as VehicleStatusValue);
  }

  static sold(): VehicleStatus {
    return new VehicleStatus('sold');
  }

  static submitted(): VehicleStatus {
    return new VehicleStatus('submitted');
  }

  isTerminal(): boolean {
    return TERMINAL.includes(this.value);
  }

  canTransitionTo(next: VehicleStatus): boolean {
    return ALLOWED[this.value].includes(next.value);
  }
}
