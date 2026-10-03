import { Router, type RequestHandler } from 'express';

import type { ChangeVehicleStatusController } from './controllers/change-vehicle-status.controller';
import type { ConfirmVehicleDocumentController } from './controllers/confirm-vehicle-document.controller';
import type { ConfirmVehicleMediaController } from './controllers/confirm-vehicle-media.controller';
import type { CreateVehicleController } from './controllers/create-vehicle.controller';
import type { CreateVehicleDocumentUploadController } from './controllers/create-vehicle-document-upload.controller';
import type { CreateVehicleMediaUploadController } from './controllers/create-vehicle-media-upload.controller';
import type { DeleteVehicleDocumentController } from './controllers/delete-vehicle-document.controller';
import type { DeleteVehicleMediaController } from './controllers/delete-vehicle-media.controller';
import type { GetVehicleController } from './controllers/get-vehicle.controller';
import type { ListVehicleDocumentsController } from './controllers/list-vehicle-documents.controller';
import type { ListVehicleMediaController } from './controllers/list-vehicle-media.controller';
import type { ListVehicleStatusHistoryController } from './controllers/list-vehicle-status-history.controller';
import type { ListVehiclesController } from './controllers/list-vehicles.controller';
import type { UpdateVehicleController } from './controllers/update-vehicle.controller';

export interface VehiclesRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly createVehicleController: CreateVehicleController;
  readonly listVehiclesController: ListVehiclesController;
  readonly getVehicleController: GetVehicleController;
  readonly updateVehicleController: UpdateVehicleController;
  readonly changeVehicleStatusController: ChangeVehicleStatusController;
  readonly listVehicleStatusHistoryController: ListVehicleStatusHistoryController;
  readonly createVehicleMediaUploadController: CreateVehicleMediaUploadController;
  readonly confirmVehicleMediaController: ConfirmVehicleMediaController;
  readonly listVehicleMediaController: ListVehicleMediaController;
  readonly deleteVehicleMediaController: DeleteVehicleMediaController;
  readonly createVehicleDocumentUploadController: CreateVehicleDocumentUploadController;
  readonly confirmVehicleDocumentController: ConfirmVehicleDocumentController;
  readonly listVehicleDocumentsController: ListVehicleDocumentsController;
  readonly deleteVehicleDocumentController: DeleteVehicleDocumentController;
}

export function createVehiclesRouter(deps: VehiclesRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.post('/', deps.createVehicleController.handle());
  router.get('/', deps.listVehiclesController.handle());
  router.post('/:id/status', deps.changeVehicleStatusController.handle());
  router.get('/:id/status-history', deps.listVehicleStatusHistoryController.handle());
  router.post('/:id/media/uploads', deps.createVehicleMediaUploadController.handle());
  router.post('/:id/media', deps.confirmVehicleMediaController.handle());
  router.get('/:id/media', deps.listVehicleMediaController.handle());
  router.delete('/:id/media/:mediaId', deps.deleteVehicleMediaController.handle());
  router.post('/:id/documents/uploads', deps.createVehicleDocumentUploadController.handle());
  router.post('/:id/documents', deps.confirmVehicleDocumentController.handle());
  router.get('/:id/documents', deps.listVehicleDocumentsController.handle());
  router.delete('/:id/documents/:documentId', deps.deleteVehicleDocumentController.handle());
  router.get('/:id', deps.getVehicleController.handle());
  router.patch('/:id', deps.updateVehicleController.handle());

  return router;
}
