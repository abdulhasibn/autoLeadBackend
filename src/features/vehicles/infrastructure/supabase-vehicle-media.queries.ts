import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { IVehicleMediaQueries, VehicleMediaReadModel } from '../domain/vehicle-media.queries';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
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
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list vehicle media: ${error.message}`);
    }

    const items = ((data ?? []) as VehicleMediaRow[]).map(toVehicleMediaReadModel);
    return toPage(items, count ?? items.length, page);
  }

  async findFrontImagePaths(
    vehicleIds: readonly VehicleId[],
  ): Promise<ReadonlyMap<VehicleId, string>> {
    if (vehicleIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.db
      .from('vehicle_media')
      .select('vehicle_id, storage_path')
      .in('vehicle_id', [...vehicleIds])
      .eq('category', 'front')
      .order('sort_order', { ascending: true })
      .order('uploaded_at', { ascending: true });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle front images: ${error.message}`);
    }

    // Rows arrive best-first, so the first row seen for a vehicle wins.
    const paths = new Map<VehicleId, string>();
    for (const row of data ?? []) {
      const vehicleId = toVehicleId(row.vehicle_id);
      if (!paths.has(vehicleId)) {
        paths.set(vehicleId, row.storage_path);
      }
    }
    return paths;
  }
}
