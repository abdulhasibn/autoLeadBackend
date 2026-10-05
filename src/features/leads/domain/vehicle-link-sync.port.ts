import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/** Keeps a vehicle `linked` exactly while it has active leads. Must be idempotent (ADR-0011). */
export interface IVehicleLinkSync {
  syncLinkState(vehicleId: VehicleId, hasActiveLeads: boolean, actorId: UserId): Promise<void>;
}
