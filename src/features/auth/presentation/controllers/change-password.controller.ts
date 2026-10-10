import type { RequestHandler } from 'express';

import type { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case';
import {
  requireAccessToken,
  requireAuth,
} from '../../../../presentation/http/middleware/require-auth';
import { changePasswordBodySchema } from '../schemas/change-password.schemas';

/**
 * POST /auth/change-password
 * Requires: Bearer token (applied by auth router)
 * Accepts: { currentPassword: string, newPassword: string }
 * Success: 204 — other sessions are ended, this one stays signed in
 */
export class ChangePasswordController {
  constructor(private readonly changePassword: ChangePasswordUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const actor = requireAuth(req);
        const accessToken = requireAccessToken(req);
        const body = changePasswordBodySchema.parse(req.body);
        await this.changePassword.execute({
          actor,
          accessToken,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
