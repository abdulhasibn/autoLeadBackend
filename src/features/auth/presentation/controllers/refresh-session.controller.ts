import type { RequestHandler } from 'express';

import type { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { refreshSessionBodySchema } from '../schemas/refresh-session.schemas';

/**
 * POST /auth/refresh
 * Accepts: { refreshToken: string }
 * Success: 200 { accessToken, refreshToken }
 */
export class RefreshSessionController {
  constructor(private readonly refreshSession: RefreshSessionUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = refreshSessionBodySchema.parse(req.body);
        const session = await this.refreshSession.execute({
          refreshToken: body.refreshToken,
        });
        res.status(200).json(session);
      } catch (err) {
        next(err);
      }
    };
  }
}
