import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';

/**
 * Token verifier port — validates a raw Bearer token and returns the
 * authenticated context (userId + roles) or null when the token is invalid/expired.
 *
 * Used exclusively by the bearer middleware; kept in application/ports so the
 * middleware depends on an interface, not on a Supabase client directly.
 */
export interface ITokenVerifier {
  verify(bearerToken: string): Promise<AuthenticatedContext | null>;
}
