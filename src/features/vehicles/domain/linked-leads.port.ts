import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** The leads that keep a vehicle `linked`. Implemented by the leads feature (ADR-0011). */
export interface ILinkedLeads {
  countActive(vehicleId: VehicleId): Promise<number>;
  unlinkAll(vehicleId: VehicleId, actorId: UserId): Promise<void>;
}
