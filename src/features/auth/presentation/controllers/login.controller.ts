import type { RequestHandler } from 'express';

import type { LoginUseCase } from '../../application/use-cases/login.use-case';
import { loginBodySchema } from '../schemas/login.schemas';

/**
 * POST /auth/login
 * Accepts: { email: string, password: string }
 * Success: 200 { accessToken, refreshToken }
 */
export class LoginController {
  constructor(private readonly login: LoginUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const body = loginBodySchema.parse(req.body);
        const session = await this.login.execute({
          email: body.email,
          password: body.password,
        });
        res.status(200).json(session);
      } catch (err) {
        next(err);
      }
    };
  }
}
