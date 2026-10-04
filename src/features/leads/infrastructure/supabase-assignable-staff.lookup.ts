import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { STAFF_ROLES } from '../../../domain/shared/role';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { IAssignableStaffLookup } from '../domain/assignable-staff.port';

export class SupabaseAssignableStaffLookup implements IAssignableStaffLookup {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async isAssignable(userId: UserId): Promise<boolean> {
    const { data, error } = await this.db
      .from('user_roles')
      .select('user_id, roles!inner(name), users!user_id!inner(deleted_at)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .is('users.deleted_at', null)
      .in('roles.name', [...STAFF_ROLES])
      .limit(1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to check lead assignee: ${error.message}`);
    }

    return (data ?? []).length > 0;
  }
}
