import type { RequestHandler } from 'express';

import type { SendOtpUseCase } from '../../application/use-cases/send-otp.use-case';
import { sendOtpBodySchema } from '../schemas/send-otp.schemas';

/**
 * POST /auth/otp/send
 * Accepts: { phone: string }
 * Success: 204 No Content
 */
export class SendOtpController {
  constructor(private readonly sendOtp: SendOtpUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = sendOtpBodySchema.parse(req.body);
        await this.sendOtp.execute({ phone: body.phone });
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
