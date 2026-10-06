import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { DocumentId } from '../domain/document-id';
import type { VehicleDocument } from '../domain/vehicle-document.entity';
import type { IVehicleDocumentRepository } from '../domain/vehicle-document.repository';
import { translateVehicleWriteError } from './translate-vehicle-write-error';
import { toVehicleDocument, type VehicleDocumentRow } from './vehicle-document.mapper';

const DOCUMENT_COLUMNS =
  'id, vehicle_id, storage_path, doc_type, file_name, is_sensitive, uploaded_by, uploaded_at';

export class SupabaseVehicleDocumentRepository implements IVehicleDocumentRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: DocumentId): Promise<VehicleDocument | null> {
    const { data, error } = await this.db
      .from('vehicle_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle document: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toVehicleDocument(data as VehicleDocumentRow);
  }

  async save(document: VehicleDocument): Promise<void> {
    const { error } = await this.db.from('vehicle_documents').insert({
      id: document.id,
      vehicle_id: document.vehicleId,
      storage_path: document.storagePath.value,
      doc_type: document.docType.value,
      file_name: document.fileName === null ? null : document.fileName.value,
      is_sensitive: document.isSensitive,
      uploaded_by: document.uploadedBy,
      uploaded_at: document.uploadedAt.toISOString(),
    });

    if (error !== null) {
      translateVehicleWriteError(
        error,
        'Failed to save vehicle document',
        'This file has already been attached',
      );
    }
  }

  async delete(id: DocumentId): Promise<void> {
    const { error } = await this.db.from('vehicle_documents').delete().eq('id', id);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to delete vehicle document: ${error.message}`);
    }
  }
}
