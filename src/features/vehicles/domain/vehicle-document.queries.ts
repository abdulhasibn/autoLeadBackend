import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';

export interface VehicleDocumentReadModel {
  readonly id: string;
  readonly vehicleId: string;
  readonly storagePath: string;
  readonly docType: string | null;
  readonly isSensitive: boolean;
  readonly uploadedBy: string;
  readonly uploadedAt: string;
}

export interface IVehicleDocumentQueries {
  listByVehicle(vehicleId: VehicleId, page: Pagination): Promise<Page<VehicleDocumentReadModel>>;
}
