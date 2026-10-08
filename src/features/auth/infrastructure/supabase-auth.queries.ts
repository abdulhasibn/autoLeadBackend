import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { type ShowroomId, toShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { UserProfileDto } from '../application/dtos/user-profile.dto';
import type { ActorGrants, IAuthQueries } from '../application/queries/auth.queries';

type UserRow = Database['public']['Tables']['users']['Row'];

function mapRow(row: UserRow): UserProfileDto {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    avatarUrl: row.avatar_url,
    // Roles and home showroom are loaded separately via findActor.
    roles: [],
    showroomId: null,
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

  async findActor(userId: UserId): Promise<ActorGrants> {
    const { data, error } = await this.db
      .from('user_roles')
      .select('roles!inner(name), users!user_id!inner(deleted_at, showroom_id)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('users.deleted_at', null);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to fetch user roles: ${error.message}`);
    }

    const roles: string[] = [];
    let showroomId: ShowroomId | null = null;
    for (const row of data ?? []) {
      const role = unwrapOne(row.roles)?.name ?? null;
      if (role !== null && !roles.includes(role)) {
        roles.push(role);
      }
      const showroom = unwrapOne(row.users)?.showroom_id ?? null;
      if (showroom !== null) {
        showroomId = toShowroomId(showroom);
      }
    }
    return { roles, showroomId };
  }
}

function unwrapOne<T>(value: T | T[] | null): T | null {
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}
