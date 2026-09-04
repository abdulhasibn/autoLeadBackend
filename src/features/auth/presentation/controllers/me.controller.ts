import type { RequestHandler } from 'express';

import type { GetMeUseCase } from '../../application/use-cases/get-me.use-case';
import { requireAuth } from '../middleware/bearer.middleware';

/**
 * GET /auth/me
 * Requires: Bearer token (applied by auth router)
 * Success: 200 UserProfileDto
 */
export class MeController {
  constructor(private readonly getMe: GetMeUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const profile = await this.getMe.execute(ctx);
        res.status(200).json(profile);
      } catch (err) {
        next(err);
      }
    };
  }
}
