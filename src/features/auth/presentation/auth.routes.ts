import { Router } from 'express';

import type { MeController } from './controllers/me.controller';
import type { SendOtpController } from './controllers/send-otp.controller';
import type { VerifyOtpController } from './controllers/verify-otp.controller';
import type { RequestHandler } from 'express';

export interface AuthRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly sendOtpController: SendOtpController;
  readonly verifyOtpController: VerifyOtpController;
  readonly meController: MeController;
}

/**
 * Mounts auth routes under the prefix chosen by the composition root (/auth).
 *
 * POST /auth/otp/send   — no auth required
 * POST /auth/otp/verify — no auth required
 * GET  /auth/me         — bearer required
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/otp/send', deps.sendOtpController.handle());
  router.post('/otp/verify', deps.verifyOtpController.handle());
  router.get('/me', deps.bearerMiddleware, deps.meController.handle());

  return router;
}
