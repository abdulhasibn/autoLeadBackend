import { Router } from 'express';

import type { ChangePasswordController } from './controllers/change-password.controller';
import type { ForgotPasswordController } from './controllers/forgot-password.controller';
import type { LogoutController } from './controllers/logout.controller';
import type { MeController } from './controllers/me.controller';
import type { LoginController } from './controllers/login.controller';
import type { RefreshSessionController } from './controllers/refresh-session.controller';
import type { ResetPasswordController } from './controllers/reset-password.controller';
import type { RequestHandler } from 'express';

export interface AuthRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly loginController: LoginController;
  readonly refreshSessionController: RefreshSessionController;
  readonly meController: MeController;
  readonly logoutController: LogoutController;
  readonly changePasswordController: ChangePasswordController;
  readonly forgotPasswordController: ForgotPasswordController;
  readonly resetPasswordController: ResetPasswordController;
}

/**
 * Mounts auth routes under the prefix chosen by the composition root (/auth).
 *
 * POST /auth/login           — no auth required
 * POST /auth/refresh         — no auth required
 * POST /auth/forgot-password — no auth required
 * POST /auth/reset-password  — no auth required
 * GET  /auth/me              — bearer required
 * POST /auth/logout          — bearer required
 * POST /auth/change-password — bearer required
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/login', deps.loginController.handle());
  router.post('/refresh', deps.refreshSessionController.handle());
  router.post('/forgot-password', deps.forgotPasswordController.handle());
  router.post('/reset-password', deps.resetPasswordController.handle());
  router.get('/me', deps.bearerMiddleware, deps.meController.handle());
  router.post('/logout', deps.bearerMiddleware, deps.logoutController.handle());
  router.post('/change-password', deps.bearerMiddleware, deps.changePasswordController.handle());

  return router;
}
