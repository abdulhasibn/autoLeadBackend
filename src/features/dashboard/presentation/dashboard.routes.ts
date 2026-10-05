import { Router, type RequestHandler } from 'express';

import type { GetDashboardController } from './controllers/get-dashboard.controller';

export interface DashboardRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly getDashboardController: GetDashboardController;
}

export function createDashboardRouter(deps: DashboardRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.get('/', deps.getDashboardController.handle());

  return router;
}
