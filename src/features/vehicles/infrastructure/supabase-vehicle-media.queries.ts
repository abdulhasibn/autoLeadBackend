import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { IVehicleMediaQueries, VehicleMediaReadModel } from '../domain/vehicle-media.queries';
import { toVehicleMediaReadModel, type VehicleMediaRow } from './vehicle-media.mapper';

const MEDIA_COLUMNS =
  'id, vehicle_id, storage_path, category, sort_order, uploaded_by, uploaded_at';

export class SupabaseVehicleMediaQueries implements IVehicleMediaQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listByVehicle(
    vehicleId: VehicleId,
    page: Pagination,
  ): Promise<Page<VehicleMediaReadModel>> {
    const { data, error, count } = await this.db
      .from('vehicle_media')
      .select(MEDIA_COLUMNS, { count: 'exact' })
      .eq('vehicle_id', vehicleId)
      .order('sort_order', { ascending: true })
      .order('uploaded_at', { ascending: true })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list vehicle media: ${error.message}`);
    }

    const items = ((data ?? []) as VehicleMediaRow[]).map(toVehicleMediaReadModel);
    return toPage(items, count ?? items.length, page);
  }
}
