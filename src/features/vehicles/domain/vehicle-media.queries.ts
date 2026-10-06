import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface VehicleMediaReadModel {
  readonly id: string;
  readonly vehicleId: string;
  readonly storagePath: string;
  readonly category: string | null;
  readonly sortOrder: number;
  readonly uploadedBy: string;
  readonly uploadedAt: string;
}

export interface IVehicleMediaQueries {
  listByVehicle(vehicleId: VehicleId, page: Pagination): Promise<Page<VehicleMediaReadModel>>;
  /**
   * Storage path of each vehicle's cover photo: its `front` photo with the
   * lowest sort order (earliest upload breaks ties). Vehicles with no front
   * photo are absent from the map.
   */
  findFrontImagePaths(vehicleIds: readonly VehicleId[]): Promise<ReadonlyMap<VehicleId, string>>;
}
