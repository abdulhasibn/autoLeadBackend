import type { RequestHandler } from 'express';

import { AuthenticationRequiredError } from '../../../../domain/errors/authentication-required.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { ITokenVerifier } from '../../application/ports/token-verifier.port';

// Ensure the Express.Request augmentation is loaded.
import './express-auth.d';

/**
 * Parses the Authorization header, delegates verification to ITokenVerifier,
 * and attaches the resolved AuthenticatedContext to req.auth.
 *
 * Throw AuthenticationRequiredError (→ 401) when:
 * - The header is absent or malformed.
 * - The token is invalid or expired.
 */
export function createBearerMiddleware(tokenVerifier: ITokenVerifier): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;

      if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
        return next(new AuthenticationRequiredError());
      }

      const token = header.slice('Bearer '.length).trim();
      if (token.length === 0) {
        return next(new AuthenticationRequiredError());
      }

      const ctx = await tokenVerifier.verify(token);
      if (ctx === null) {
        return next(new AuthenticationRequiredError());
      }

      req.auth = ctx;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

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
