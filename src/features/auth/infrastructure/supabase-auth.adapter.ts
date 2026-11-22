import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { AuthSession, SignOutScope } from '../application/ports/auth.port';
import type { IAuthProvider } from '../application/ports/auth.port';
import type { ITokenVerifier } from '../application/ports/token-verifier.port';
import { isProviderFailure, isRateLimited, toUnexpectedAuthError } from './supabase-auth-errors';

/**
 * Supabase Auth adapter — implements IAuthProvider (email + password) and
 * ITokenVerifier (JWT → user id). Roles are loaded separately from user_roles.
 *
 * Uses the anon-key client for all auth operations:
 * - sign-in and refresh do not require elevated privileges.
 * - getUser(token) validates the JWT server-side and handles revoked tokens.
 * The client is shared across requests, so only stateless calls that take the
 * user's JWT explicitly are allowed here (see supabase-client.ts).
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
      throw new InvalidCredentialsError('Invalid or expired refresh token');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async signOut(accessToken: string, scope: SignOutScope): Promise<void> {
    // admin.signOut is a stateless POST /logout carrying the user's own JWT;
    // it needs no service-role key and never touches this client's session.
    const { error } = await this.anonClient.auth.admin.signOut(accessToken, scope);

    // A 4xx means the session is already gone or the token expired: the
    // caller is signed out either way, so sign-out stays idempotent.
    if (error !== null && isProviderFailure(error)) {
      throw toUnexpectedAuthError(error, 'sign out');
    }
  }

  // ── ITokenVerifier ────────────────────────────────────────────────────────

  async verify(bearerToken: string): Promise<UserId | null> {
    const { data, error } = await this.anonClient.auth.getUser(bearerToken);

    if (error !== null) {
      // An outage or throttle says nothing about the token: surface it as
      // 503 / 429 so clients retry instead of signing the user out. Every
      // other error (invalid, expired, revoked, session gone) is a plain 401.
      if (isProviderFailure(error) || isRateLimited(error)) {
        throw toUnexpectedAuthError(error, 'verify token');
      }
      return null;
    }
    if (data.user === null) {
      return null;
    }

    return toUserId(data.user.id);
  }

  claimedSubject(bearerToken: string): UserId | null {
    const payload = bearerToken.split('.')[1];
    if (payload === undefined || payload === '') {
      return null;
    }
    try {
      const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (typeof claims !== 'object' || claims === null || !('sub' in claims)) {
        return null;
      }
      const { sub } = claims;
      return typeof sub === 'string' && sub !== '' ? toUserId(sub) : null;
    } catch {
      return null;
    }
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
