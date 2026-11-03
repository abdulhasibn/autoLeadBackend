import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { SealedVehicleDeal } from './sealed-finance-records';

/** Read side of car deals. Rows stay sealed; the application decrypts them. */
export interface IVehicleDealQueries {
  find(vehicleId: VehicleId): Promise<SealedVehicleDeal | null>;
  findMany(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleDeal[]>;
  /** Deals with a sale recorded between these dates (YYYY-MM-DD, inclusive). */
  findSoldBetween(from: string, to: string): Promise<readonly SealedVehicleDeal[]>;
  /** Every deal holding terms or a sale. */
  findWithData(): Promise<readonly SealedVehicleDeal[]>;
}
