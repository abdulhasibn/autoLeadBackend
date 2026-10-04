import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  IStaffQueries,
  StaffListCriteria,
  StaffMemberReadModel,
} from '../domain/staff.queries';
import { STAFF_ROLE_NAMES } from '../domain/staff-role.value-object';
import { toStaffMemberReadModel, type StaffUserRow } from './staff-user.mapper';

interface RoleEmbed {
  readonly name: string;
}

interface ListedRoleRow {
  readonly user_id: string;
  readonly roles: RoleEmbed | RoleEmbed[] | null;
  readonly users: StaffUserRow | StaffUserRow[] | null;
}

interface UserRoleEmbed {
  readonly deleted_at: string | null;
  readonly roles: RoleEmbed | null;
}

interface UserWithRolesRow extends StaffUserRow {
  readonly user_roles: UserRoleEmbed[] | null;
}

export class SupabaseStaffQueries implements IStaffQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listStaff(
    criteria: StaffListCriteria,
    page: Pagination,
  ): Promise<Page<StaffMemberReadModel>> {
    const { data, error } = await this.db
      .from('user_roles')
      .select(
        'user_id, roles!inner ( name ), users!user_id!inner ( id, full_name, phone, email, showroom_id, created_at, deleted_at )',
      )
      .is('deleted_at', null)
      .is('users.deleted_at', null)
      .in('roles.name', [...STAFF_ROLE_NAMES]);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list staff: ${error.message}`);
    }

    const grouped = groupStaffRows((data ?? []) as unknown as ListedRoleRow[]);
    const roleFilter = criteria.role;
    const filtered =
      roleFilter === undefined
        ? grouped
        : grouped.filter((member) => member.roles.includes(roleFilter));

    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = sorted.slice(page.offset, page.offset + page.limit);
    return toPage(items, sorted.length, page);
  }

  async getStaff(id: UserId): Promise<StaffMemberReadModel | null> {
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
    const roleNames = (row.user_roles ?? []).flatMap((embed) => {
      if (embed.deleted_at !== null || embed.roles === null) {
        return [];
      }
      return [embed.roles.name];
    });
    return toStaffMemberReadModel(row, roleNames);
  }
}

function groupStaffRows(rows: readonly ListedRoleRow[]): StaffMemberReadModel[] {
  const rolesByUser = new Map<string, { row: StaffUserRow; roles: string[] }>();

  for (const item of rows) {
    const user = unwrapRelation(item.users);
    const role = unwrapRelation(item.roles);
    if (user === null || role === null || user.deleted_at !== null) {
      continue;
    }

    const existing = rolesByUser.get(user.id);
    if (existing === undefined) {
      rolesByUser.set(user.id, { row: user, roles: [role.name] });
    } else if (!existing.roles.includes(role.name)) {
      existing.roles.push(role.name);
    }
  }

  const members: StaffMemberReadModel[] = [];
  for (const { row, roles } of rolesByUser.values()) {
    const member = toStaffMemberReadModel(row, roles);
    if (member !== null) {
      members.push(member);
    }
  }
  return members;
}

function unwrapRelation<T>(value: T | T[] | null): T | null {
  if (value === null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
