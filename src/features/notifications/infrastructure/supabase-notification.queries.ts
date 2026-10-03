import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { isNotificationDue } from '../domain/is-notification-due';
import type { INotificationQueries, NotificationReadModel } from '../domain/notification.queries';
import { toNotificationReadModel, type NotificationRow } from './notification.mapper';

const COLUMNS = 'id, type, title, body, entity_type, entity_id, is_read, due_at, created_at';

export class SupabaseNotificationQueries implements INotificationQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listDue(userId: UserId, now: Date, page: Pagination): Promise<Page<NotificationReadModel>> {
    const { data, error, count } = await this.db
      .from('notifications')
      .select(COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .or(`due_at.is.null,due_at.lte.${now.toISOString()}`)
      .order('created_at', { ascending: false })
      .range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list notifications: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as NotificationRow[])
      .filter((row) => isNotificationDue(row.due_at === null ? null : new Date(row.due_at), now))
      .map((row) => toNotificationReadModel(row));

    return toPage(items, count ?? items.length, page);
  }
}
