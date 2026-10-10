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

/** Read port the vehicles feature implements for lead matching. */
export interface IMatchableVehicleLookup {
  /** A live (not deleted) vehicle, or null. */
  findForMatching(vehicleId: VehicleId): Promise<MatchableVehicle | null>;
}
