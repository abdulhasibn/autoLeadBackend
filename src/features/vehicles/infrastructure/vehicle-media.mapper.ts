import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { MediaCategory } from '../domain/media-category.value-object';
import { toMediaId } from '../domain/media-id';
import { VehicleMedia } from '../domain/vehicle-media.entity';
import type { VehicleMediaReadModel } from '../domain/vehicle-media.queries';
import { VehicleObjectPath } from '../domain/vehicle-object-path.value-object';

export interface VehicleMediaRow {
  readonly id: string;
  readonly vehicle_id: string;
  readonly storage_path: string;
  readonly category: string | null;
  readonly sort_order: number;
  readonly uploaded_by: string;
  readonly uploaded_at: string;
}

export function toVehicleMedia(row: VehicleMediaRow): VehicleMedia {
  if (row.category === null) {
    throw new DataIntegrityError(`Vehicle media ${row.id} is missing a category`);
  }

  try {
    return VehicleMedia.reconstitute({
      id: toMediaId(row.id),
      vehicleId: toVehicleId(row.vehicle_id),
      storagePath: VehicleObjectPath.create(toVehicleId(row.vehicle_id), row.storage_path),
      category: MediaCategory.create(row.category),
      sortOrder: row.sort_order,
      uploadedBy: toUserId(row.uploaded_by),
      uploadedAt: new Date(row.uploaded_at),
    });
  } catch (err) {
    throw new DataIntegrityError(`Vehicle media ${row.id} is invalid`, { cause: err });
  }
}

export function toVehicleMediaReadModel(row: VehicleMediaRow): VehicleMediaReadModel {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    storagePath: row.storage_path,
    category: row.category,
    sortOrder: row.sort_order,
    uploadedBy: row.uploaded_by,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
  };
}
