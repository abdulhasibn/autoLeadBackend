import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  IVehicleDocumentQueries,
  VehicleDocumentReadModel,
} from '../domain/vehicle-document.queries';
import { toVehicleDocumentReadModel, type VehicleDocumentRow } from './vehicle-document.mapper';

const DOCUMENT_COLUMNS =
  'id, vehicle_id, storage_path, doc_type, file_name, is_sensitive, uploaded_by, uploaded_at';

export class SupabaseVehicleDocumentQueries implements IVehicleDocumentQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listByVehicle(
    vehicleId: VehicleId,
    page: Pagination,
  ): Promise<Page<VehicleDocumentReadModel>> {
    const { data, error, count } = await this.db
      .from('vehicle_documents')
      .select(DOCUMENT_COLUMNS, { count: 'exact' })
      .eq('vehicle_id', vehicleId)
      .order('uploaded_at', { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list vehicle documents: ${error.message}`);
    }

    const items = ((data ?? []) as VehicleDocumentRow[]).map(toVehicleDocumentReadModel);
    return toPage(items, count ?? items.length, page);
  }
}
