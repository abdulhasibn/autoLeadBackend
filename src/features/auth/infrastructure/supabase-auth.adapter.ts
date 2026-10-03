import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { AuthSession } from '../application/ports/auth.port';
import type { IAuthProvider } from '../application/ports/auth.port';
import type { ITokenVerifier } from '../application/ports/token-verifier.port';

/**
 * Supabase Auth adapter — implements IAuthProvider (email + password) and
 * ITokenVerifier (JWT → user id). Roles are loaded separately from user_roles.
 *
 * Uses the anon-key client for all auth operations:
 * - sign-in and refresh do not require elevated privileges.
 * - getUser(token) validates the JWT server-side and handles revoked tokens.
 */
export class SupabaseAuthAdapter implements IAuthProvider, ITokenVerifier {
  constructor(private readonly anonClient: SupabaseClient<Database>) {}

  // ── IAuthProvider ─────────────────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.anonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error !== null || data.session === null) {
      throw new InvalidCredentialsError();
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const { data, error } = await this.anonClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error !== null || data.session === null) {
      throw new InvalidCredentialsError();
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  // ── ITokenVerifier ────────────────────────────────────────────────────────

  async verify(bearerToken: string): Promise<UserId | null> {
    const { data, error } = await this.anonClient.auth.getUser(bearerToken);

    if (error !== null || data.user === null) {
      return null;
    }

    return toUserId(data.user.id);
  }
}

/**
 * Thrown when email/password or a refresh token is rejected.
 * Mapped to 401 via the feature error mapper registered in composition.
 */
export class InvalidCredentialsError extends Error {
  readonly code = 'INVALID_CREDENTIALS';

  constructor(message = 'Invalid email or password') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}
