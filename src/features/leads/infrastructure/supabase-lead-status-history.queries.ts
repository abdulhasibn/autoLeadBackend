import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  ILeadStatusHistoryQueries,
  LeadStatusHistoryReadModel,
} from '../domain/lead-status-history.queries';

const HISTORY_COLUMNS =
  'id, lead_id, from_status, to_status, changed_by, notes, changed_at, actor:users!changed_by ( full_name )';

interface HistoryRow {
  readonly id: string;
  readonly lead_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly changed_by: string;
  readonly notes: string | null;
  readonly changed_at: string;
  readonly actor: { readonly full_name: string } | null;
}

export class SupabaseLeadStatusHistoryQueries implements ILeadStatusHistoryQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listByLead(leadId: LeadId, page: Pagination): Promise<Page<LeadStatusHistoryReadModel>> {
    const { data, error, count } = await this.db
      .from('lead_status_history')
      .select(HISTORY_COLUMNS, { count: 'exact' })
      .eq('lead_id', leadId)
      .order('changed_at', { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list lead status history: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as HistoryRow[]).map((row) => ({
      id: row.id,
      leadId: row.lead_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      changedBy: row.changed_by,
      changedByName: row.actor?.full_name ?? null,
      notes: row.notes,
      changedAt: new Date(row.changed_at).toISOString(),
    }));

    return toPage(items, count ?? items.length, page);
  }
}
