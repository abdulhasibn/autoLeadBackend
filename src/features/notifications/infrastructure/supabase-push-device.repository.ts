import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { IPushDeviceRepository, PushDeviceRegistration } from '../domain/push.ports';

export class SupabasePushDeviceRepository implements IPushDeviceRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async upsert(registration: PushDeviceRegistration): Promise<void> {
    const { error } = await this.db.from('device_push_tokens').upsert(
      {
        user_id: registration.userId,
        expo_push_token: registration.token,
        platform: registration.platform,
        enabled: registration.enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' },
    );
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to save push device: ${error.message}`);
    }
  }

  async remove(userId: UserId, token: string): Promise<void> {
    const { error } = await this.db
      .from('device_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('expo_push_token', token);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to remove push device: ${error.message}`);
    }
  }

  async findEnabledTokens(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const result = new Map<string, string[]>();
    if (userIds.length === 0) return result;

    const { data, error } = await this.db
      .from('device_push_tokens')
      .select('user_id, expo_push_token')
      .in('user_id', [...userIds])
      .eq('enabled', true);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load push devices: ${error.message}`);
    }

    for (const row of data) {
      const tokens = result.get(row.user_id) ?? [];
      tokens.push(row.expo_push_token);
      result.set(row.user_id, tokens);
    }
    return result;
  }

  async removeTokens(tokens: readonly string[]): Promise<void> {
    if (tokens.length === 0) return;
    const { error } = await this.db
      .from('device_push_tokens')
      .delete()
      .in('expo_push_token', [...tokens]);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to prune push devices: ${error.message}`);
    }
  }
}
