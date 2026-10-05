import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  DashboardRange,
  DashboardScope,
  DashboardSummaryReadModel,
  IDashboardQueries,
} from '../domain/dashboard.queries';
import { toDashboardSummaryReadModel, type DashboardSummaryJson } from './dashboard-summary.mapper';

export class SupabaseDashboardQueries implements IDashboardQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getSummary(
    scope: DashboardScope,
    range: DashboardRange,
  ): Promise<DashboardSummaryReadModel> {
    const { data, error } = await this.db.rpc('dashboard_summary', {
      p_showroom_id: scope.showroomId,
      p_assignee_id: scope.assigneeId,
      p_from: range.from.toISOString(),
      p_now: range.now.toISOString(),
      p_prev_from: range.previousFrom.toISOString(),
      p_prev_until: range.previousUntil.toISOString(),
      p_today_end: range.todayEnd.toISOString(),
      p_aged_before: range.agedBefore.toISOString(),
      p_list_limit: range.listLimit,
    });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load dashboard: ${error.message}`);
    }

    return toDashboardSummaryReadModel(data as unknown as DashboardSummaryJson);
  }
}
