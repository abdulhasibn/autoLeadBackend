import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { NotificationId } from '../../../domain/shared/notification-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { INotificationRepository } from '../domain/notification.repository';

export class SupabaseNotificationRepository implements INotificationRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async markRead(id: NotificationId, userId: UserId): Promise<boolean> {
    const { data, error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to mark notification read: ${error.message}`);
    }

    return data !== null;
  }
}
