import type { UserId } from '../../../../domain/shared/user-id';

/**
 * Validates a raw Bearer token and returns the Auth user id, or null when
 * the token is invalid or expired. Roles are not read from the JWT — they
 * are loaded from public.user_roles by AuthenticateActorUseCase.
 */
export interface ITokenVerifier {
  verify(bearerToken: string): Promise<UserId | null>;
}
