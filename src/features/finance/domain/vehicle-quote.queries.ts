import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { SealedVehicleQuote } from './sealed-finance-records';

/** Read side of quotes. Live quotes only; rows stay sealed. */
export interface IVehicleQuoteQueries {
  listForVehicles(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleQuote[]>;
}
