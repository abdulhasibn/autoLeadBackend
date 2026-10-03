import type { VehicleId } from '../../../domain/shared/vehicle-id';

export interface ILiveVehicleLookup {
  isLive(vehicleId: VehicleId): Promise<boolean>;
}
