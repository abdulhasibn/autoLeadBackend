import type { UserId } from '../../../../domain/shared/user-id';

/**
 * Validates a raw Bearer token and returns the Auth user id, or null when
 * the token is invalid or expired. Roles are not read from the JWT — they
 * are loaded from public.user_roles by AuthenticateActorUseCase.
 */
export interface ITokenVerifier {
  verify(bearerToken: string): Promise<UserId | null>;

  /**
   * The user id the token claims (its `sub`), read without checking the
   * signature, expiry or session. Null when the token cannot be decoded.
   * Only a hint for starting work early: never authorize from it.
   */
  claimedSubject(bearerToken: string): UserId | null;
}
