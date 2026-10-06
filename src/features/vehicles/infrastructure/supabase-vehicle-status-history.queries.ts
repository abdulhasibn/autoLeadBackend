import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  IVehicleStatusHistoryQueries,
  VehicleStatusHistoryReadModel,
} from '../domain/vehicle-status-history.queries';

// `users!changed_by`: name the FK so the embed stays unambiguous if another
// users reference is ever added to this table.
const HISTORY_COLUMNS =
  'id, vehicle_id, from_status, to_status, changed_by, reason, changed_at, actor:users!changed_by ( full_name )';

interface HistoryRow {
  readonly id: string;
  readonly vehicle_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly changed_by: string;
  readonly reason: string | null;
  readonly changed_at: string;
  readonly actor: { readonly full_name: string } | null;
}

export class SupabaseVehicleStatusHistoryQueries implements IVehicleStatusHistoryQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listByVehicle(
    vehicleId: VehicleId,
    page: Pagination,
  ): Promise<Page<VehicleStatusHistoryReadModel>> {
    const { data, error, count } = await this.db
      .from('vehicle_status_history')
      .select(HISTORY_COLUMNS, { count: 'exact' })
      .eq('vehicle_id', vehicleId)
      .order('changed_at', { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list vehicle status history: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as HistoryRow[]).map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedBy: row.changed_by,
      changedByName: row.actor?.full_name ?? null,
      reason: row.reason,
      changedAt: new Date(row.changed_at).toISOString(),
    }));

    return toPage(items, count ?? items.length, page);
  }
}
