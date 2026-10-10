import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Logger } from '../../../shared/logging/logger.port';
import { AuthRateLimitedError } from '../infrastructure/supabase-auth-errors';
import { SupabasePasswordCredentials } from '../infrastructure/supabase-password-credentials.adapter';

const USER_ID = toUserId('11111111-1111-4111-8111-111111111111');

interface FakeError {
  readonly message: string;
  readonly code?: string;
  readonly status?: number;
}

/** Just enough of `client.auth` for the adapter, with programmable replies. */
class FakeAuth {
  signOuts: Array<{ jwt: string; scope: string }> = [];
  updates: Array<{ id: string; password: string }> = [];
  signInError: FakeError | null = null;
  updateError: FakeError | null = null;
  resetError: FakeError | null = null;
  verifyError: FakeError | null = null;

  readonly admin = {
    getUserById: async () => ({ data: { user: { email: 'ada@example.com' } }, error: null }),
    updateUserById: async (id: string, attrs: { password: string }) => {
      this.updates.push({ id, password: attrs.password });
      return { data: {}, error: this.updateError };
    },
    signOut: async (jwt: string, scope: string) => {
      this.signOuts.push({ jwt, scope });
      return { data: null, error: null };
    },
  };

  signInWithPassword = async () =>
    this.signInError === null
      ? { data: { session: { access_token: 'tmp-token' } }, error: null }
      : { data: { session: null }, error: this.signInError };

  resetPasswordForEmail = async () => ({ data: {}, error: this.resetError });

  verifyOtp = async () =>
    this.verifyError === null
      ? {
          data: { user: { id: USER_ID }, session: { access_token: 'recovery-token' } },
          error: null,
        }
      : { data: { user: null, session: null }, error: this.verifyError };
}

class SpyLogger implements Logger {
  warnings: unknown[] = [];
  info(): void {}
  error(): void {}
  warn(...args: unknown[]): void {
    this.warnings.push(args);
  }
  child(): Logger {
    return this;
  }
}

function setup() {
  const auth = new FakeAuth();
  const client = { auth } as unknown as SupabaseClient<Database>;
  const logger = new SpyLogger();
  return { auth, logger, adapter: new SupabasePasswordCredentials(client, client, logger) };
}

describe('SupabasePasswordCredentials', () => {
  describe('verifyPassword', () => {
    it('returns true and ends the throwaway session it opened', async () => {
      const { auth, adapter } = setup();

      await expect(adapter.verifyPassword(USER_ID, 'secret12')).resolves.toBe(true);
      expect(auth.signOuts).toEqual([{ jwt: 'tmp-token', scope: 'local' }]);
    });

    it('returns false on invalid credentials', async () => {
      const { auth, adapter } = setup();
      auth.signInError = { message: 'Invalid', code: 'invalid_credentials', status: 400 };

      await expect(adapter.verifyPassword(USER_ID, 'wrong')).resolves.toBe(false);
      expect(auth.signOuts).toEqual([]);
    });

    it('surfaces throttling as a rate-limit error', async () => {
      const { auth, adapter } = setup();
      auth.signInError = { message: 'Slow down', code: 'over_request_rate_limit', status: 429 };

      await expect(adapter.verifyPassword(USER_ID, 'x')).rejects.toBeInstanceOf(
        AuthRateLimitedError,
      );
    });
  });

  describe('setPassword', () => {
    it('updates the password by user id', async () => {
      const { auth, adapter } = setup();

      await adapter.setPassword(USER_ID, 'new-secret-1');
      expect(auth.updates).toEqual([{ id: USER_ID, password: 'new-secret-1' }]);
    });

    it.each([
      ['weak_password', 'WEAK_PASSWORD'],
      ['same_password', 'PASSWORD_UNCHANGED'],
    ])('maps %s to %s', async (providerCode, code) => {
      const { auth, adapter } = setup();
      auth.updateError = { message: 'nope', code: providerCode, status: 422 };

      const attempt = adapter.setPassword(USER_ID, 'new-secret-1');
      await expect(attempt).rejects.toBeInstanceOf(BusinessRuleViolationError);
      await expect(attempt).rejects.toMatchObject({ code });
    });
  });

  describe('sendResetCode', () => {
    it('answers the same way when the provider refuses, and logs no address', async () => {
      const { auth, logger, adapter } = setup();
      auth.resetError = { message: 'Too often', code: 'over_email_send_rate_limit', status: 429 };

      await expect(adapter.sendResetCode('ada@example.com')).resolves.toBeUndefined();
      expect(JSON.stringify(logger.warnings)).not.toContain('ada@example.com');
      expect(logger.warnings).toHaveLength(1);
    });

    it('fails when the provider is down', async () => {
      const { auth, adapter } = setup();
      auth.resetError = { message: 'SMTP down', status: 500 };

      await expect(adapter.sendResetCode('ada@example.com')).rejects.toBeInstanceOf(
        DatabaseUnavailableError,
      );
    });
  });

  describe('redeemResetCode', () => {
    it('returns the user and recovery token for a valid code', async () => {
      const { adapter } = setup();

      await expect(adapter.redeemResetCode('ada@example.com', '123456')).resolves.toEqual({
        userId: USER_ID,
        accessToken: 'recovery-token',
      });
    });

    it('returns null for an expired or wrong code', async () => {
      const { auth, adapter } = setup();
      auth.verifyError = { message: 'Token has expired', code: 'otp_expired', status: 403 };

      await expect(adapter.redeemResetCode('ada@example.com', '123456')).resolves.toBeNull();
    });
  });
});
