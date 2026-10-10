import { AuthenticationRequiredError } from '../../../domain/errors/authentication-required.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';

/**
 * Narrows `req.auth` to a guaranteed `AuthenticatedContext`.
 * Call this at the top of any controller action that requires authentication.
 * Throws AuthenticationRequiredError if the middleware was somehow skipped.
 */
export function requireAuth(req: { auth?: AuthenticatedContext }): AuthenticatedContext {
  if (req.auth === undefined) {
    throw new AuthenticationRequiredError();
  }
  return req.auth;
}

/**
 * Returns the bearer token the request was authenticated with, for actions
 * that act on the caller's own session (sign out, change password).
 * Throws AuthenticationRequiredError if the bearer middleware was skipped.
 */
export function requireAccessToken(req: { accessToken?: string }): string {
  if (req.accessToken === undefined) {
    throw new AuthenticationRequiredError();
  }
  return req.accessToken;
}
