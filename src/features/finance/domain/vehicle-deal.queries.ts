import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { SealedVehicleDeal } from './sealed-finance-records';

/** Read side of car deals. Rows stay sealed; the application decrypts them. */
export interface IVehicleDealQueries {
  find(vehicleId: VehicleId): Promise<SealedVehicleDeal | null>;
  findMany(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleDeal[]>;
}
