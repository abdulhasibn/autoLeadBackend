import { Router } from 'express';

import type { MeController } from './controllers/me.controller';
import type { LoginController } from './controllers/login.controller';
import type { RefreshSessionController } from './controllers/refresh-session.controller';
import type { RequestHandler } from 'express';

export interface AuthRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly loginController: LoginController;
  readonly refreshSessionController: RefreshSessionController;
  readonly meController: MeController;
}

/**
 * Mounts auth routes under the prefix chosen by the composition root (/auth).
 *
 * POST /auth/login   — no auth required
 * POST /auth/refresh — no auth required
 * GET  /auth/me      — bearer required
 */
export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  router.post('/login', deps.loginController.handle());
  router.post('/refresh', deps.refreshSessionController.handle());
  router.get('/me', deps.bearerMiddleware, deps.meController.handle());

  return router;
}
