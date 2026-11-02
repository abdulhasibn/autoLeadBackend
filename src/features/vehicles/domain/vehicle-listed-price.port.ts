import type { VehicleId } from '../../../domain/shared/vehicle-id';

/**
 * The asking price shown to buyers on the public website. It lives in
 * `vehicle_financials.listed_price`, plaintext by design (ADR-0014); every
 * other price on that row is internal and is never written here.
 */
export interface IVehicleListedPriceWriter {
  set(vehicleId: VehicleId, listedPrice: number | null): Promise<void>;
}
