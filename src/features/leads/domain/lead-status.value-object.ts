export const LEAD_STATUSES = [
  'new',
  'in_progress',
  'not_now',
  'booking_confirmed',
  'converted',
  'lost',
  'vehicle_unavailable',
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

/** Leads in these statuses keep their vehicle `linked`. */
export const ACTIVE_LEAD_STATUSES: readonly LeadStatusValue[] = [
  'new',
  'in_progress',
  'not_now',
  'booking_confirmed',
];

/** Open leads still shopping for a vehicle: candidates for match suggestions. */
export const MATCHABLE_LEAD_STATUSES: readonly LeadStatusValue[] = [
  'new',
  'in_progress',
  'not_now',
  'vehicle_unavailable',
];

const TERMINAL: readonly LeadStatusValue[] = ['converted', 'lost'];

const REQUIRES_VEHICLE: readonly LeadStatusValue[] = ['booking_confirmed', 'converted'];

// Set only when another lead buys this lead's vehicle.
const SYSTEM_ONLY: readonly LeadStatusValue[] = ['vehicle_unavailable'];

// Once a lead is `in_progress` it never goes back to `new`: `new` means
// nobody has reached the customer yet.
const ALLOWED: Readonly<Record<LeadStatusValue, readonly LeadStatusValue[]>> = {
  new: ['in_progress', 'not_now', 'booking_confirmed', 'lost', 'vehicle_unavailable'],
  in_progress: ['not_now', 'booking_confirmed', 'lost', 'vehicle_unavailable'],
  not_now: ['new', 'in_progress', 'booking_confirmed', 'lost', 'vehicle_unavailable'],
  booking_confirmed: ['converted', 'lost', 'vehicle_unavailable'],
  converted: [],
  lost: [],
  vehicle_unavailable: ['new', 'in_progress', 'not_now', 'booking_confirmed', 'lost'],
};

export class LeadStatus {
  private constructor(readonly value: LeadStatusValue) {}

  static create(input: string): LeadStatus {
    const trimmed = input.trim();
    if (!LEAD_STATUSES.includes(trimmed as LeadStatusValue)) {
      throw new Error('Invalid lead status');
    }
    return new LeadStatus(trimmed as LeadStatusValue);
  }

  static initial(): LeadStatus {
    return new LeadStatus('new');
  }

  static inProgress(): LeadStatus {
    return new LeadStatus('in_progress');
  }

  static vehicleUnavailable(): LeadStatus {
    return new LeadStatus('vehicle_unavailable');
  }

  isTerminal(): boolean {
    return TERMINAL.includes(this.value);
  }

  isActive(): boolean {
    return ACTIVE_LEAD_STATUSES.includes(this.value);
  }

  requiresVehicle(): boolean {
    return REQUIRES_VEHICLE.includes(this.value);
  }

  isManuallySettable(): boolean {
    return !SYSTEM_ONLY.includes(this.value);
  }

  canTransitionTo(next: LeadStatus): boolean {
    return ALLOWED[this.value].includes(next.value);
  }
}
