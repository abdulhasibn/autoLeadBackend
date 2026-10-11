import type { SupabaseClient } from '@supabase/supabase-js';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Logger } from '../../../shared/logging/logger.port';
import type {
  IPasswordCredentials,
  RedeemedResetCode,
} from '../application/ports/password-credentials.port';
import {
  type AuthErrorLike,
  isProviderFailure,
  isRateLimited,
  toUnexpectedAuthError,
} from './supabase-auth-errors';

/**
 * Supabase Auth adapter for password checks, changes and email reset codes.
 *
 * - `anonClient` runs the user-facing calls (sign-in, reset email, OTP verify).
 * - `adminClient` (service role) looks users up and sets passwords by id.
 *
 * Both clients are shared across requests: every call passes the user's id,
 * email or JWT explicitly and never relies on a session stored on the client.
 */
export class SupabasePasswordCredentials implements IPasswordCredentials {
  constructor(
    private readonly anonClient: SupabaseClient<Database>,
    private readonly adminClient: SupabaseClient<Database>,
    private readonly logger: Logger,
  ) {}

  async verifyPassword(userId: UserId, password: string): Promise<boolean> {
    const { data: found, error: lookupError } =
      await this.adminClient.auth.admin.getUserById(userId);
    if (lookupError !== null) {
      throw toUnexpectedAuthError(lookupError, 'look up auth user');
    }
    const email = found.user.email;
    if (email === undefined || email.length === 0) {
      return false;
    }

    const { data, error } = await this.anonClient.auth.signInWithPassword({ email, password });
    if (error !== null) {
      if (isRateLimited(error) || isProviderFailure(error)) {
        throw toUnexpectedAuthError(error, 'verify password');
      }
      return false;
    }

    // The check opened a session nobody will use; end it straight away.
    await this.anonClient.auth.admin.signOut(data.session.access_token, 'local');
    return true;
  }

  async setPassword(userId: UserId, password: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.updateUserById(userId, { password });
    if (error === null) {
      return;
    }
    if (error.code === 'same_password') {
      throw new BusinessRuleViolationError(
        'PASSWORD_UNCHANGED',
        'New password must be different from the current password',
      );
    }
    if (error.code === 'weak_password') {
      throw new BusinessRuleViolationError('WEAK_PASSWORD', 'Password is too weak');
    }
    throw toUnexpectedAuthError(error, 'set password');
  }

  async sendResetCode(email: string): Promise<void> {
    const { error } = await this.anonClient.auth.resetPasswordForEmail(email);
    if (error === null) {
      return;
    }
    if (isProviderFailure(error)) {
      throw new DatabaseUnavailableError(`Failed to send reset code: ${error.message}`);
    }
    // Throttling or an unknown address: answer as if the email went out, so
    // the endpoint can't tell anyone which addresses have accounts.
    this.logger.warn(authErrorContext(error), 'Password reset email not sent');
  }

  async redeemResetCode(email: string, code: string): Promise<RedeemedResetCode | null> {
    const { data, error } = await this.anonClient.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });
    if (error !== null) {
      if (isRateLimited(error) || isProviderFailure(error)) {
        throw toUnexpectedAuthError(error, 'verify reset code');
      }
      return null;
    }
    if (data.user === null || data.session === null) {
      return null;
    }
    return { userId: toUserId(data.user.id), accessToken: data.session.access_token };
  }
}

/** Error fields safe to log: never the email, code or password. */
function authErrorContext(error: AuthErrorLike): Record<string, unknown> {
  return { authErrorCode: error.code ?? null, authErrorStatus: error.status ?? null };
}
