import type { LeadMatch } from '../../domain/lead-vehicle-match';
import type { LeadReadModel } from '../../domain/lead.queries';
import type { MatchableVehicle } from '../../domain/matchable-vehicle.port';

export interface ListVehicleLeadMatchesQuery {
  readonly vehicleId: string;
  /** Lowest score a suggestion may have. */
  readonly minScore: number;
  /** Most suggestions to return. */
  readonly limit: number;
}

/** A lead with how well the vehicle fits its preference; `match` is null when it has none. */
export type LeadMatchDto = LeadReadModel & { readonly match: LeadMatch | null };

export interface VehicleLeadMatchesDto {
  readonly vehicle: MatchableVehicle;
  /** Leads linked to the vehicle, best match first. */
  readonly linked: readonly LeadMatchDto[];
  /** Open, unlinked leads that fit the vehicle, best match first. */
  readonly suggested: readonly LeadMatchDto[];
  /** Only the newest candidates were scored for suggestions. */
  readonly truncated: boolean;
}

export interface ListLeadVehicleMatchesQuery {
  readonly leadId: string;
  /** Lowest score a suggestion may have. */
  readonly minScore: number;
  /** Most suggestions to return. */
  readonly limit: number;
}

/** A vehicle with how well it fits the lead; `match` is null when the lead has no preference. */
export interface VehicleMatchDto {
  readonly vehicle: MatchableVehicle;
  readonly match: LeadMatch | null;
}

export interface LeadVehicleMatchesDto {
  /** The vehicle linked to the lead; null when none (or it was deleted). */
  readonly linked: VehicleMatchDto | null;
  /** Linkable vehicles in the lead's showroom that fit it, best match first. */
  readonly suggested: readonly VehicleMatchDto[];
  /** Only the newest vehicles were scored for suggestions. */
  readonly truncated: boolean;
}
