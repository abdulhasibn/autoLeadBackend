import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { IPendingPushRepository, PendingPush } from '../domain/push.ports';

export class SupabasePendingPushRepository implements IPendingPushRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async claim(limit: number): Promise<readonly PendingPush[]> {
    const { data, error } = await this.db.rpc('claim_pending_pushes', { p_limit: limit });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to claim pending pushes: ${error.message}`);
    }
    return data.map((row) => ({
      id: row.id,
      userId: toUserId(row.user_id),
      type: row.type,
      title: row.title,
      body: row.body,
      entityType: row.entity_type,
      entityId: row.entity_id,
    }));
  }
}
