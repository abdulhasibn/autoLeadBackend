export const VEHICLE_STATUSES = ['open', 'linked', 'dropped', 'sold'] as const;

export type VehicleStatusValue = (typeof VEHICLE_STATUSES)[number];

const TERMINAL: readonly VehicleStatusValue[] = ['sold'];

// `linked` and `sold` follow the vehicle's leads; an admin only drops or re-lists.
const ADMIN_SETTABLE: readonly VehicleStatusValue[] = ['open', 'dropped'];

const LINKABLE: readonly VehicleStatusValue[] = ['open', 'linked'];

const ALLOWED: Readonly<Record<VehicleStatusValue, readonly VehicleStatusValue[]>> = {
  open: ['linked', 'dropped'],
  linked: ['open', 'sold', 'dropped'],
  dropped: ['open'],
  sold: [],
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

  static open(): VehicleStatus {
    return new VehicleStatus('open');
  }

  static linked(): VehicleStatus {
    return new VehicleStatus('linked');
  }

  static dropped(): VehicleStatus {
    return new VehicleStatus('dropped');
  }

  static sold(): VehicleStatus {
    return new VehicleStatus('sold');
  }

  isTerminal(): boolean {
    return TERMINAL.includes(this.value);
  }

  isAdminSettable(): boolean {
    return ADMIN_SETTABLE.includes(this.value);
  }

  /** Whether a lead may be attached to a vehicle in this status. */
  isLinkable(): boolean {
    return LINKABLE.includes(this.value);
  }

  canTransitionTo(next: VehicleStatus): boolean {
    return ALLOWED[this.value].includes(next.value);
  }
}
