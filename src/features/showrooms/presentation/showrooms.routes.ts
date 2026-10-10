import { Router, type RequestHandler } from 'express';

import type { ListShowroomsController } from './controllers/list-showrooms.controller';

export interface ShowroomsRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly listShowroomsController: ListShowroomsController;
}

export function createShowroomsRouter(deps: ShowroomsRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.get('/', deps.listShowroomsController.handle());

  return router;
}
