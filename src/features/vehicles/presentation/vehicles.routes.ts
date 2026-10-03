import { Router, type RequestHandler } from 'express';

import type { CreateVehicleController } from './controllers/create-vehicle.controller';
import type { GetVehicleController } from './controllers/get-vehicle.controller';
import type { ListVehiclesController } from './controllers/list-vehicles.controller';
import type { UpdateVehicleController } from './controllers/update-vehicle.controller';

export interface VehiclesRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly createVehicleController: CreateVehicleController;
  readonly listVehiclesController: ListVehiclesController;
  readonly getVehicleController: GetVehicleController;
  readonly updateVehicleController: UpdateVehicleController;
}

export function createVehiclesRouter(deps: VehiclesRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.post('/', deps.createVehicleController.handle());
  router.get('/', deps.listVehiclesController.handle());
  router.get('/:id', deps.getVehicleController.handle());
  router.patch('/:id', deps.updateVehicleController.handle());

  return router;
}
