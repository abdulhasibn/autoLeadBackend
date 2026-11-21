import type { LeadAttribution, ShowroomLocation } from './test-drive-intake.port';

export interface PreferenceIntakeInput {
  readonly fullName: string;
  /** E.164. */
  readonly phone: string;
  /** Keyed hash of the caller's IP, for rate limiting only. */
  readonly ipHash: string;
  /** Stored only when a new lead is created. */
  readonly attribution: LeadAttribution | null;
  /** Rupees. */
  readonly budgetMax: number | null;
  readonly bodyTypes: readonly string[];
  readonly fuelTypes: readonly string[];
  readonly transmissions: readonly string[];
  readonly make: string | null;
  readonly model: string | null;
  /** A car the visitor liked; mentioned in the lead notes, never linked. */
  readonly referenceVehicleId: string | null;
}

export interface PreferenceIntakeResult {
  readonly leadId: string;
  /** `updated` when an open web lead without a car was merged into. */
  readonly outcome: 'created' | 'updated';
  readonly showroom: ShowroomLocation | null;
}

/**
 * Records a "tell us what you want" request in one transaction: rate limit,
 * contact find-or-create (never renaming), then a new lead or a merge into the
 * contact's open, car-less web lead, and notifying the assignee or every admin.
 */
export interface IPreferenceIntake {
  submit(input: PreferenceIntakeInput): Promise<PreferenceIntakeResult>;
}
