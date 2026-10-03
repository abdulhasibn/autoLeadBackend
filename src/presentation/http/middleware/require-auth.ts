import { AuthenticationRequiredError } from '../../../domain/errors/authentication-required.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';

// Ensure the Express.Request augmentation is loaded for every consumer.
import '../express-auth.d';

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
