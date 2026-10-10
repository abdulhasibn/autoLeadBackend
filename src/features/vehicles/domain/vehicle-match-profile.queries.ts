import type { BodyTypeValue } from '../../../domain/shared/body-type.value-object';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** A vehicle's attributes in the terms buyers state preferences in. */
export interface VehicleMatchProfile {
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
  /** `vehicle_financials.listed_price`; null until the vehicle is priced. */
  readonly listedPrice: number | null;
}

/** Read side for features that score vehicles against buyer preferences (leads). */
export interface IVehicleMatchProfiles {
  /** A live (not deleted) vehicle, or null. */
  findForMatching(vehicleId: VehicleId): Promise<VehicleMatchProfile | null>;
}
