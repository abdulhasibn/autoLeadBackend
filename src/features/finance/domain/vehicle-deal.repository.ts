import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { SealedVehicleDeal } from './sealed-finance-records';

/** Command-side persistence for a car's deal (one row per car). */
export interface IVehicleDealRepository {
  find(vehicleId: VehicleId): Promise<SealedVehicleDeal | null>;
  /** Inserts or updates by car. */
  save(deal: SealedVehicleDeal): Promise<void>;
}
