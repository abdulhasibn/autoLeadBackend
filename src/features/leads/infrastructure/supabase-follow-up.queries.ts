import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { FollowUpStatus } from '../domain/follow-up.entity';
import type {
  FollowUpListScope,
  FollowUpReadModel,
  IFollowUpQueries,
} from '../domain/follow-up.queries';

const FOLLOW_UP_COLUMNS = [
  'id, lead_id, task_type, scheduled_at, notes, outcome, completion_notes',
  'completed_at, completed_by, deleted_at, cancelled_by, assigned_to, created_by, created_at',
  'assignee:users!assigned_to ( full_name )',
  'creator:users!created_by ( full_name )',
  'completer:users!completed_by ( full_name )',
  'canceller:users!cancelled_by ( full_name )',
].join(', ');

interface UserName {
  readonly full_name: string;
}

interface FollowUpListRow {
  readonly id: string;
  readonly lead_id: string;
  readonly task_type: string;
  readonly scheduled_at: string;
  readonly notes: string | null;
  readonly outcome: string | null;
  readonly completion_notes: string | null;
  readonly completed_at: string | null;
  readonly completed_by: string | null;
  readonly deleted_at: string | null;
  readonly cancelled_by: string | null;
  readonly assigned_to: string;
  readonly created_by: string;
  readonly created_at: string;
  readonly assignee: UserName | null;
  readonly creator: UserName | null;
  readonly completer: UserName | null;
  readonly canceller: UserName | null;
}

export class SupabaseFollowUpQueries implements IFollowUpQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listByLead(
    leadId: LeadId,
    scope: FollowUpListScope,
    page: Pagination,
  ): Promise<Page<FollowUpReadModel>> {
    let query = this.db
      .from('follow_ups')
      .select(FOLLOW_UP_COLUMNS, { count: 'exact' })
      .eq('lead_id', leadId);

    if (scope === 'open') {
      query = query
        .is('completed_at', null)
        .is('deleted_at', null)
        .order('scheduled_at', { ascending: true });
    } else if (scope === 'closed') {
      // Closing stamps updated_at with the completion / cancellation time.
      query = query
        .or('completed_at.not.is.null,deleted_at.not.is.null')
        .order('updated_at', { ascending: false });
    } else {
      query = query.order('scheduled_at', { ascending: false });
    }

    const { data, error, count } = await query.range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list follow-ups: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as FollowUpListRow[]).map(toReadModel);
    return toPage(items, count ?? items.length, page);
  }
}

function toReadModel(row: FollowUpListRow): FollowUpReadModel {
  const status: FollowUpStatus =
    row.completed_at !== null ? 'completed' : row.deleted_at !== null ? 'cancelled' : 'open';
  return {
    id: row.id,
    leadId: row.lead_id,
    taskType: row.task_type,
    scheduledAt: iso(row.scheduled_at),
    notes: row.notes,
    status,
    outcome: row.outcome,
    completionNotes: row.completion_notes,
    completedAt: row.completed_at === null ? null : iso(row.completed_at),
    completedBy: row.completed_by,
    completedByName: row.completer?.full_name ?? null,
    cancelledAt: status === 'cancelled' && row.deleted_at !== null ? iso(row.deleted_at) : null,
    cancelledBy: status === 'cancelled' ? row.cancelled_by : null,
    cancelledByName: status === 'cancelled' ? (row.canceller?.full_name ?? null) : null,
    assignedTo: row.assigned_to,
    assignedToName: row.assignee?.full_name ?? null,
    createdBy: row.created_by,
    createdByName: row.creator?.full_name ?? null,
    createdAt: iso(row.created_at),
  };
}

function iso(value: string): string {
  return new Date(value).toISOString();
}
