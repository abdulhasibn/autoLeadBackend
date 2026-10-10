import type { RequestHandler } from 'express';

import type { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { resetPasswordBodySchema } from '../schemas/reset-password.schemas';

/**
 * POST /auth/reset-password
 * Accepts: { email: string, code: string, newPassword: string }
 * Success: 204 — every session is ended; the user signs in again
 */
export class ResetPasswordController {
  constructor(private readonly resetPassword: ResetPasswordUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = resetPasswordBodySchema.parse(req.body);
        await this.resetPassword.execute({
          email: body.email,
          code: body.code,
          newPassword: body.newPassword,
        });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
