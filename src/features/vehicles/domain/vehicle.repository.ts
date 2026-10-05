import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Vehicle } from './vehicle.entity';

/**
 * Command-side persistence for the Vehicle aggregate.
 * Listing lives on IVehicleQueries.
 */
export interface IVehicleRepository {
  findById(id: VehicleId): Promise<Vehicle | null>;
  save(vehicle: Vehicle, actorId: UserId): Promise<void>;
}
