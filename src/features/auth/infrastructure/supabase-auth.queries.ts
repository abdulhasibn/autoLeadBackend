import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { UserProfileDto } from '../application/dtos/user-profile.dto';
import type { IAuthQueries } from '../application/queries/auth.queries';

type UserRow = Database['public']['Tables']['users']['Row'];

function mapRow(row: UserRow): UserProfileDto {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    // Roles are merged in at the use-case level from the JWT context.
    roles: [],
  };
}

/**
 * Reads auth-scoped profile data from `public.users` via the service-role client.
 * Raw rows are mapped before leaving this adapter.
 */
export class SupabaseAuthQueries implements IAuthQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findProfile(userId: UserId): Promise<UserProfileDto | null> {
    const { data, error } = await this.db
      .from('users')
      .select('id, full_name, phone, email, avatar_url')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(
        `Failed to fetch user profile: ${error.message}`,
      );
    }

    if (data === null) {
      return null;
    }

    return mapRow(data as UserRow);
  }
}
