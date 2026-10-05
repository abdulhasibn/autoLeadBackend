import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** `unavailable`: the vehicle exists but is sold or dropped, so no lead may link to it. */
export type VehicleLinkability = 'linkable' | 'unavailable' | 'not_found';

export interface ILinkableVehicleLookup {
  linkability(vehicleId: VehicleId): Promise<VehicleLinkability>;
}
