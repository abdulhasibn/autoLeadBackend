import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { isNotificationDue } from '../domain/is-notification-due';
import type {
  INotificationQueries,
  NotificationListCriteria,
  NotificationReadModel,
} from '../domain/notification.queries';
import { toNotificationReadModel, type NotificationRow } from './notification.mapper';

const COLUMNS =
  'id, type, title, body, entity_type, entity_id, lead_id, is_read, due_at, created_at, leads!lead_id(id, contacts!contact_id(full_name, phone))';

export class SupabaseNotificationQueries implements INotificationQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listDue(
    userId: UserId,
    now: Date,
    criteria: NotificationListCriteria,
    page: Pagination,
  ): Promise<Page<NotificationReadModel>> {
    let query = this.db
      .from('notifications')
      .select(COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .or(dueFilter(now));
    if (criteria.isRead !== undefined) {
      query = query.eq('is_read', criteria.isRead);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list notifications: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as NotificationRow[])
      .filter((row) => isNotificationDue(row.due_at === null ? null : new Date(row.due_at), now))
      .map((row) => toNotificationReadModel(row));

    return toPage(items, count ?? items.length, page);
  }

  async countUnreadDue(userId: UserId, now: Date): Promise<number> {
    const { error, count } = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
      .or(dueFilter(now));

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to count notifications: ${error.message}`);
    }
    return count ?? 0;
  }
}

function dueFilter(now: Date): string {
  return `due_at.is.null,due_at.lte.${now.toISOString()}`;
}
