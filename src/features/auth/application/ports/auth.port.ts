export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Which sessions a sign-out ends: only the caller's (`local`), every session of
 * the user (`global`), or every session except the caller's (`others`).
 */
export type SignOutScope = 'local' | 'global' | 'others';

/**
 * Auth provider port — email + password session operations.
 * Use cases depend on this interface; Supabase Auth is one implementation.
 */
export interface IAuthProvider {
  /**
   * Exchanges an email + password pair for session credentials.
   * Rejects with an Error when credentials are invalid.
   */
  signIn(email: string, password: string): Promise<AuthSession>;

  /**
   * Rotates a refresh token into a new session.
   * Rejects with an Error when the refresh token is invalid or expired.
   */
  refresh(refreshToken: string): Promise<AuthSession>;

  /**
   * Ends the sessions selected by `scope`, starting from the session that
   * `accessToken` belongs to. Resolves when that session is already gone.
   */
  signOut(accessToken: string, scope: SignOutScope): Promise<void>;
}
