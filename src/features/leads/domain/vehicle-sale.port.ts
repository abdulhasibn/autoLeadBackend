import type { LeadId } from '../../../domain/shared/lead-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/**
 * Sells a lead's vehicle to that lead. Must validate the vehicle's status graph
 * before writing and be a no-op when the vehicle is already sold to the same
 * lead, so a conversion can be retried safely (ADR-0006, ADR-0011).
 */
export interface IVehicleSale {
  markSold(vehicleId: VehicleId, leadId: LeadId, actorId: UserId, reason: string): Promise<void>;
}
