import { Router, type RequestHandler } from 'express';

import type { ListMakesController } from './controllers/list-makes.controller';
import type { ListModelsController } from './controllers/list-models.controller';
import type { ListVariantsController } from './controllers/list-variants.controller';

export interface CatalogRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly listMakesController: ListMakesController;
  readonly listModelsController: ListModelsController;
  readonly listVariantsController: ListVariantsController;
}

export function createCatalogRouter(deps: CatalogRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.get('/makes', deps.listMakesController.handle());
  router.get('/makes/:makeId/models', deps.listModelsController.handle());
  router.get('/models/:modelId/variants', deps.listVariantsController.handle());

  return router;
}
