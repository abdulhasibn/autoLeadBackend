import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { toDocumentId } from '../domain/document-id';
import { DocumentType } from '../domain/document-type.value-object';
import { VehicleDocument } from '../domain/vehicle-document.entity';
import type { VehicleDocumentReadModel } from '../domain/vehicle-document.queries';
import { VehicleObjectPath } from '../domain/vehicle-object-path.value-object';

export interface VehicleDocumentRow {
  readonly id: string;
  readonly vehicle_id: string;
  readonly storage_path: string;
  readonly doc_type: string | null;
  readonly is_sensitive: boolean;
  readonly uploaded_by: string;
  readonly uploaded_at: string;
}

export function toVehicleDocument(row: VehicleDocumentRow): VehicleDocument {
  if (row.doc_type === null) {
    throw new DataIntegrityError(`Vehicle document ${row.id} is missing a type`);
  }

  try {
    return VehicleDocument.reconstitute({
      id: toDocumentId(row.id),
      vehicleId: toVehicleId(row.vehicle_id),
      storagePath: VehicleObjectPath.create(toVehicleId(row.vehicle_id), row.storage_path),
      docType: DocumentType.create(row.doc_type),
      isSensitive: row.is_sensitive,
      uploadedBy: toUserId(row.uploaded_by),
      uploadedAt: new Date(row.uploaded_at),
    });
  } catch (err) {
    throw new DataIntegrityError(`Vehicle document ${row.id} is invalid`, { cause: err });
  }
}

export function toVehicleDocumentReadModel(row: VehicleDocumentRow): VehicleDocumentReadModel {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    storagePath: row.storage_path,
    docType: row.doc_type,
    isSensitive: row.is_sensitive,
    uploadedBy: row.uploaded_by,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
  };
}
