import type { RequestHandler } from 'express';

import type { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { requireAccessToken } from '../../../../presentation/http/middleware/require-auth';
import { logoutBodySchema } from '../schemas/logout.schemas';

/**
 * POST /auth/logout
 * Requires: Bearer token (applied by auth router)
 * Accepts: { scope?: "local" | "global" } (default "local")
 * Success: 204
 */
export class LogoutController {
  constructor(private readonly logout: LogoutUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const accessToken = requireAccessToken(req);
        const body = logoutBodySchema.parse(req.body);
        await this.logout.execute({ accessToken, scope: body.scope });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
