import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { UniqueViolationError } from '../../../domain/errors/unique-violation.error';
import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  IAuthUserProvisioner,
  ProvisionAuthUserCommand,
} from '../application/ports/auth-user-provisioner.port';

/**
 * Service-role Auth admin adapter. Creates the auth.users row that public.users.id mirrors.
 */
export class SupabaseAuthUserProvisioner implements IAuthUserProvisioner {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async provision(command: ProvisionAuthUserCommand): Promise<UserId> {
    const { data, error } = await this.db.auth.admin.createUser({
      email: command.email,
      password: command.password,
      email_confirm: true,
    });

    if (error !== null) {
      if (isAlreadyRegistered(error.message)) {
        throw new UniqueViolationError('A staff user with this email already exists');
      }
      throw new DatabaseUnavailableError(`Failed to provision auth user: ${error.message}`);
    }
    if (data.user === null) {
      throw new DatabaseUnavailableError('Failed to provision auth user: empty response');
    }

    return toUserId(data.user.id);
  }

  async updateEmail(userId: UserId, email: string): Promise<void> {
    const { error } = await this.db.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });

    if (error !== null) {
      if (isAlreadyRegistered(error.message)) {
        throw new UniqueViolationError('A staff user with this email already exists');
      }
      throw new DatabaseUnavailableError(`Failed to update auth email: ${error.message}`);
    }
  }

  async disable(userId: UserId): Promise<void> {
    const { error } = await this.db.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to disable auth user: ${error.message}`);
    }
  }

  async delete(userId: UserId): Promise<void> {
    const { error } = await this.db.auth.admin.deleteUser(userId);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to delete auth user: ${error.message}`);
    }
  }
}

function isAlreadyRegistered(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('already') || lowered.includes('registered') || lowered.includes('exists')
  );
}
