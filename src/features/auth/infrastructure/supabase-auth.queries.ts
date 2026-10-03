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
    // Roles are loaded separately via findLiveRoles.
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
      throw new DatabaseUnavailableError(`Failed to fetch user profile: ${error.message}`);
    }

    if (data === null) {
      return null;
    }

    return mapRow(data as UserRow);
  }

  async findLiveRoles(userId: UserId): Promise<ReadonlyArray<string>> {
    const { data, error } = await this.db
      .from('user_roles')
      .select('roles!inner(name), users!inner(deleted_at)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('users.deleted_at', null);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to fetch user roles: ${error.message}`);
    }

    const names: string[] = [];
    for (const row of data ?? []) {
      const role = unwrapRoleName(row.roles);
      if (role !== null && !names.includes(role)) {
        names.push(role);
      }
    }
    return names;
  }
}

function unwrapRoleName(value: { name: string } | { name: string }[] | null): string | null {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }
  return value.name;
}
