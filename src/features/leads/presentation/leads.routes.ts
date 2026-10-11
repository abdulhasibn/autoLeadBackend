import { Router, type RequestHandler } from 'express';

import type { AssignLeadController } from './controllers/assign-lead.controller';
import type { CancelFollowUpController } from './controllers/cancel-follow-up.controller';
import type { CompleteFollowUpController } from './controllers/complete-follow-up.controller';
import type { AssociateLeadVehicleController } from './controllers/associate-lead-vehicle.controller';
import type { ChangeLeadStatusController } from './controllers/change-lead-status.controller';
import type { CreateLeadController } from './controllers/create-lead.controller';
import type { GetLeadController } from './controllers/get-lead.controller';
import type { ListLeadFollowUpsController } from './controllers/list-lead-follow-ups.controller';
import type { ListLeadVehicleMatchesController } from './controllers/list-lead-vehicle-matches.controller';
import type { ListLeadStatusHistoryController } from './controllers/list-lead-status-history.controller';
import type { ListLeadsController } from './controllers/list-leads.controller';
import type { ListVehicleLeadMatchesController } from './controllers/list-vehicle-lead-matches.controller';
import type { RemoveLeadVehicleController } from './controllers/remove-lead-vehicle.controller';
import type { ScheduleFollowUpController } from './controllers/schedule-follow-up.controller';
import type { SetLeadPreferenceController } from './controllers/set-lead-preference.controller';
import type { UpdateLeadController } from './controllers/update-lead.controller';

export interface LeadsRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly createLeadController: CreateLeadController;
  readonly listLeadsController: ListLeadsController;
  readonly getLeadController: GetLeadController;
  readonly associateLeadVehicleController: AssociateLeadVehicleController;
  readonly assignLeadController: AssignLeadController;
  readonly changeLeadStatusController: ChangeLeadStatusController;
  readonly scheduleFollowUpController: ScheduleFollowUpController;
  readonly listLeadFollowUpsController: ListLeadFollowUpsController;
  readonly completeFollowUpController: CompleteFollowUpController;
  readonly cancelFollowUpController: CancelFollowUpController;
  readonly setLeadPreferenceController: SetLeadPreferenceController;
  readonly updateLeadController: UpdateLeadController;
  readonly removeLeadVehicleController: RemoveLeadVehicleController;
  readonly listLeadStatusHistoryController: ListLeadStatusHistoryController;
  readonly listVehicleLeadMatchesController: ListVehicleLeadMatchesController;
  readonly listLeadVehicleMatchesController: ListLeadVehicleMatchesController;
}

export function createLeadsRouter(deps: LeadsRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.post('/', deps.createLeadController.handle());
  router.get('/', deps.listLeadsController.handle());
  // Before '/:id' so 'vehicle-matches' is not read as a lead id.
  router.get('/vehicle-matches/:vehicleId', deps.listVehicleLeadMatchesController.handle());
  router.get('/:id', deps.getLeadController.handle());
  router.patch('/:id', deps.updateLeadController.handle());
  router.patch('/:id/vehicle', deps.associateLeadVehicleController.handle());
  router.delete('/:id/vehicle', deps.removeLeadVehicleController.handle());
  router.put('/:id/assignment', deps.assignLeadController.handle());
  router.put('/:id/preference', deps.setLeadPreferenceController.handle());
  router.post('/:id/status', deps.changeLeadStatusController.handle());
  router.get('/:id/status-history', deps.listLeadStatusHistoryController.handle());
  router.get('/:id/vehicle-matches', deps.listLeadVehicleMatchesController.handle());
  router.get('/:id/follow-ups', deps.listLeadFollowUpsController.handle());
  router.post('/:id/follow-ups', deps.scheduleFollowUpController.handle());
  router.post('/:id/follow-ups/:followUpId/complete', deps.completeFollowUpController.handle());
  router.post('/:id/follow-ups/:followUpId/cancel', deps.cancelFollowUpController.handle());

  return router;
}
