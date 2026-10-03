import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Vehicle } from './vehicle.entity';

/**
 * Command-side persistence for the Vehicle aggregate.
 * Listing lives on IVehicleQueries.
 */
export interface IVehicleRepository {
  findById(id: VehicleId): Promise<Vehicle | null>;
  isLive(id: VehicleId): Promise<boolean>;
  save(vehicle: Vehicle): Promise<void>;
}
