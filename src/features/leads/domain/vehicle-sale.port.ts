import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/**
 * Marks a lead's vehicle sold. Must validate the vehicle's status graph
 * before writing and be a no-op when the vehicle is already sold, so a lead
 * close can be retried safely (ADR-0006).
 */
export interface IVehicleSale {
  markSold(vehicleId: VehicleId, actorId: UserId, reason: string): Promise<void>;
}
