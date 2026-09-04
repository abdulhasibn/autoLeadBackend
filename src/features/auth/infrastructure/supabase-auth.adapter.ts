import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { OtpSession } from '../application/ports/auth.port';
import type { IAuthProvider } from '../application/ports/auth.port';
import type { ITokenVerifier } from '../application/ports/token-verifier.port';

/**
 * Supabase Auth adapter — implements IAuthProvider (OTP send/verify) and
 * ITokenVerifier (JWT → AuthenticatedContext).
 *
 * Uses the anon-key client for all auth operations:
 * - OTP flows do not require elevated privileges.
 * - getUser(token) validates the JWT server-side and handles revoked tokens.
 */
export class SupabaseAuthAdapter implements IAuthProvider, ITokenVerifier {
  constructor(private readonly anonClient: SupabaseClient<Database>) {}

  // ── IAuthProvider ─────────────────────────────────────────────────────────

  async sendOtp(phone: string): Promise<void> {
    const { error } = await this.anonClient.auth.signInWithOtp({
      phone,
      options: { channel: 'sms' },
    });

    if (error !== null) {
      throw new DatabaseUnavailableError(
        `OTP send failed: ${error.message}`,
      );
    }
  }

  async verifyOtp(phone: string, token: string): Promise<OtpSession> {
    const { data, error } = await this.anonClient.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error !== null || data.session === null) {
      throw new OtpVerificationError(error?.message ?? 'OTP verification failed');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  // ── ITokenVerifier ────────────────────────────────────────────────────────

  async verify(bearerToken: string): Promise<AuthenticatedContext | null> {
    const { data, error } = await this.anonClient.auth.getUser(bearerToken);

    if (error !== null || data.user === null) {
      return null;
    }

    const rawRoles = data.user.app_metadata?.['roles'];
    const roles: string[] = Array.isArray(rawRoles)
      ? rawRoles.filter((r): r is string => typeof r === 'string')
      : [];

    return {
      userId: toUserId(data.user.id),
      roles,
    };
  }
}

/**
 * Thrown when the OTP token is wrong or expired.
 * Mapped to 401 via the feature error mapper registered in composition.
 */
export class OtpVerificationError extends Error {
  readonly code = 'OTP_VERIFICATION_FAILED';

  constructor(message = 'Invalid or expired OTP') {
    super(message);
    this.name = 'OtpVerificationError';
  }
}
