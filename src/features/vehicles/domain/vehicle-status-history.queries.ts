import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface VehicleStatusHistoryReadModel {
  readonly id: string;
  readonly vehicleId: string;
  readonly fromStatus: string | null;
  readonly toStatus: string;
  readonly changedBy: string;
  readonly reason: string | null;
  readonly changedAt: string;
}

export interface IVehicleStatusHistoryQueries {
  listByVehicle(
    vehicleId: VehicleId,
    page: Pagination,
  ): Promise<Page<VehicleStatusHistoryReadModel>>;
}
