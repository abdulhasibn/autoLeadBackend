import type { RequestHandler } from 'express';

import type { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case';
import { forgotPasswordBodySchema } from '../schemas/forgot-password.schemas';

/** Same body for every address, so the response never reveals an account. */
const RESET_REQUESTED_MESSAGE = 'If an account exists for this email, a reset code has been sent';

/**
 * POST /auth/forgot-password
 * Accepts: { email: string }
 * Success: 202 { message }
 */
export class ForgotPasswordController {
  constructor(private readonly requestReset: RequestPasswordResetUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = forgotPasswordBodySchema.parse(req.body);
        await this.requestReset.execute({ email: body.email });
        res.status(202).json({ message: RESET_REQUESTED_MESSAGE });
      } catch (err) {
        next(err);
      }
    };
  }
}
