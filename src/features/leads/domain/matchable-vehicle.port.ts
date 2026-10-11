import type { BodyTypeValue } from '../../../domain/shared/body-type.value-object';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** The attributes of a vehicle a lead's preference is scored against. */
export interface MatchableVehicle {
  readonly id: VehicleId;
  readonly showroomId: string;
  readonly status: string;
  readonly makeId: string | null;
  readonly makeName: string | null;
  readonly modelId: string | null;
  readonly modelName: string | null;
  readonly variantId: string;
  readonly variantName: string | null;
  readonly year: number;
  readonly registrationNumber: string;
  readonly kmDriven: number;
  readonly colour: string;
  readonly fuelType: string;
  readonly transmission: string;
  /** From the catalog variant; empty when the catalog does not say. */
  readonly bodyTypes: readonly BodyTypeValue[];
  readonly numPreviousOwners: number;
  /** Asking price; null until the vehicle is priced. */
  readonly listedPrice: number | null;
}

export interface VehicleMatchCandidateCriteria {
  /** Candidates come from this showroom only. */
  readonly showroomId: string;
  /** Left out of the candidates (the lead's own vehicle). */
  readonly excludeVehicleId: VehicleId | null;
  /** Cap on candidates read. */
  readonly limit: number;
}

export interface VehicleMatchCandidates {
  /** Live vehicles a lead can still be linked to, newest first. */
  readonly vehicles: readonly MatchableVehicle[];
  /** More candidates existed than `limit`. */
  readonly truncated: boolean;
}

/** Read port the vehicles feature implements for lead matching. */
export interface IMatchableVehicleLookup {
  /** A live (not deleted) vehicle, or null. */
  findForMatching(vehicleId: VehicleId): Promise<MatchableVehicle | null>;
  /** Vehicles to score against one lead. */
  listMatchCandidates(criteria: VehicleMatchCandidateCriteria): Promise<VehicleMatchCandidates>;
}
