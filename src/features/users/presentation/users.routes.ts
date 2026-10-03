import { Router, type RequestHandler } from 'express';

import type { CreateStaffController } from './controllers/create-staff.controller';
import type { DeactivateStaffController } from './controllers/deactivate-staff.controller';
import type { GetStaffController } from './controllers/get-staff.controller';
import type { ListStaffController } from './controllers/list-staff.controller';
import type { ReplaceStaffRolesController } from './controllers/replace-staff-roles.controller';
import type { UpdateStaffController } from './controllers/update-staff.controller';

export interface UsersRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly createStaffController: CreateStaffController;
  readonly listStaffController: ListStaffController;
  readonly getStaffController: GetStaffController;
  readonly updateStaffController: UpdateStaffController;
  readonly replaceStaffRolesController: ReplaceStaffRolesController;
  readonly deactivateStaffController: DeactivateStaffController;
}

/**
 * Mounts staff routes under the prefix chosen by the composition root (/users).
 */
export function createUsersRouter(deps: UsersRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.post('/', deps.createStaffController.handle());
  router.get('/', deps.listStaffController.handle());
  router.get('/:id', deps.getStaffController.handle());
  router.patch('/:id', deps.updateStaffController.handle());
  router.put('/:id/roles', deps.replaceStaffRolesController.handle());
  router.delete('/:id', deps.deactivateStaffController.handle());

  return router;
}
