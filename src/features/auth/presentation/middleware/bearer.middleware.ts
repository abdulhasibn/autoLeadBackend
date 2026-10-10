import type { RequestHandler } from 'express';

import { AuthenticationRequiredError } from '../../../../domain/errors/authentication-required.error';
import type { AuthenticateActorUseCase } from '../../application/use-cases/authenticate-actor.use-case';

/**
 * Parses the Authorization header, resolves the actor (JWT identity + live
 * roles from user_roles), and attaches AuthenticatedContext to req.auth and
 * the raw token to req.accessToken.
 *
 * Throw AuthenticationRequiredError (→ 401) when:
 * - The header is absent or malformed.
 * - The token is invalid or expired.
 */
export function createBearerMiddleware(
  authenticateActor: AuthenticateActorUseCase,
): RequestHandler {
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

      const ctx = await authenticateActor.execute(token);
      if (ctx === null) {
        return next(new AuthenticationRequiredError());
      }

      req.auth = ctx;
      req.accessToken = token;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
