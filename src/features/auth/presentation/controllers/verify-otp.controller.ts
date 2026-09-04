import type { RequestHandler } from 'express';

import type { VerifyOtpUseCase } from '../../application/use-cases/verify-otp.use-case';
import { verifyOtpBodySchema } from '../schemas/verify-otp.schemas';

/**
 * POST /auth/otp/verify
 * Accepts: { phone: string, token: string }
 * Success: 200 { accessToken, refreshToken }
 */
export class VerifyOtpController {
  constructor(private readonly verifyOtp: VerifyOtpUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = verifyOtpBodySchema.parse(req.body);
        const session = await this.verifyOtp.execute({
          phone: body.phone,
          token: body.token,
        });
        res.status(200).json(session);
      } catch (err) {
        next(err);
      }
    };
  }
}
