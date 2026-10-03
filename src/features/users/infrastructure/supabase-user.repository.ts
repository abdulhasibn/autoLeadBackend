import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { StaffRole } from '../domain/staff-role.value-object';
import type { StaffUser } from '../domain/staff-user.entity';
import type { IUserRepository } from '../domain/user.repository';
import { toStaffUser, type StaffUserRow } from './staff-user.mapper';
import { translateWriteError } from './translate-write-error';

interface UserRoleEmbed {
  readonly deleted_at: string | null;
  readonly roles: { readonly name: string } | null;
}

interface UserWithRolesRow extends StaffUserRow {
  readonly user_roles: UserRoleEmbed[] | null;
}

export class SupabaseUserRepository implements IUserRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: UserId): Promise<StaffUser | null> {
    const { data, error } = await this.db
      .from('users')
      .select(
        'id, full_name, phone, email, showroom_id, created_at, deleted_at, user_roles ( deleted_at, roles ( name ) )',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load staff user: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    const row = data as unknown as UserWithRolesRow;
    const roleNames = liveRoleNames(row.user_roles);
    return toStaffUser(row, roleNames);
  }

  async save(user: StaffUser, grantedBy: UserId): Promise<void> {
    const { error } = await this.db.rpc('save_staff_user', {
      p_id: user.id,
      p_full_name: user.fullName,
      p_phone: user.phone.value,
      p_email: user.email,
      p_showroom_id: user.showroomId,
      p_deleted_at: user.deletedAt === null ? null : user.deletedAt.toISOString(),
      p_role_names: user.liveRoles.map((role) => role.name),
      p_granted_by: grantedBy,
    });

    if (error !== null) {
      translateWriteError(error, 'Failed to save staff user');
    }
  }

  async countLiveWithRole(role: StaffRole): Promise<number> {
    const { count, error } = await this.db
      .from('user_roles')
      .select('id, roles!inner(name), users!inner(deleted_at)', {
        count: 'exact',
        head: true,
      })
      .is('deleted_at', null)
      .is('users.deleted_at', null)
      .eq('roles.name', role.name);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to count staff by role: ${error.message}`);
    }

    return count ?? 0;
  }
}

function liveRoleNames(embeds: UserRoleEmbed[] | null): string[] {
  if (embeds === null) {
    return [];
  }
  return embeds.flatMap((embed) => {
    if (embed.deleted_at !== null || embed.roles === null) {
      return [];
    }
    return [embed.roles.name];
  });
}
