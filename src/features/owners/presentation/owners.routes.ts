import { Router, type RequestHandler } from 'express';

import type { CreateOwnerController } from './controllers/create-owner.controller';
import type { DeactivateOwnerController } from './controllers/deactivate-owner.controller';
import type { GetOwnerController } from './controllers/get-owner.controller';
import type { ListOwnersController } from './controllers/list-owners.controller';
import type { UpdateOwnerController } from './controllers/update-owner.controller';

export interface OwnersRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly createOwnerController: CreateOwnerController;
  readonly listOwnersController: ListOwnersController;
  readonly getOwnerController: GetOwnerController;
  readonly updateOwnerController: UpdateOwnerController;
  readonly deactivateOwnerController: DeactivateOwnerController;
}

/**
 * Mounts owner routes under the prefix chosen by the composition root (/owners).
 */
export function createOwnersRouter(deps: OwnersRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.post('/', deps.createOwnerController.handle());
  router.get('/', deps.listOwnersController.handle());
  router.get('/:id', deps.getOwnerController.handle());
  router.patch('/:id', deps.updateOwnerController.handle());
  router.delete('/:id', deps.deactivateOwnerController.handle());

  return router;
}
