import type { LeadPreferenceFields } from './lead-preference-fields';

export interface CreateLeadCommand extends LeadPreferenceFields {
  /** Defaults to the actor's home showroom; only admins may name another. */
  readonly showroomId: string | null;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly source: string;
  readonly vehicleId: string | null;
  readonly budget: number | null;
  readonly preferredVehicle: string | null;
  readonly purchaseTimeline: string | null;
  readonly financeRequired: boolean | null;
  readonly currentVehicle: string | null;
  readonly tradeInRequired: boolean | null;
  readonly notes: string | null;
}
