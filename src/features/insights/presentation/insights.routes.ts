import { Router, type RequestHandler } from 'express';

import type { GetDemandInsightsController } from './controllers/get-demand-insights.controller';
import type { GetLeadJourneyController } from './controllers/get-lead-journey.controller';
import type { GetTrafficInsightsController } from './controllers/get-traffic-insights.controller';
import type { GetVehicleInsightDetailController } from './controllers/get-vehicle-insight-detail.controller';
import type { GetVehicleInsightsController } from './controllers/get-vehicle-insights.controller';

export interface InsightsRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly getTrafficInsightsController: GetTrafficInsightsController;
  readonly getVehicleInsightsController: GetVehicleInsightsController;
  readonly getVehicleInsightDetailController: GetVehicleInsightDetailController;
  readonly getDemandInsightsController: GetDemandInsightsController;
  readonly getLeadJourneyController: GetLeadJourneyController;
}

export function createInsightsRouter(deps: InsightsRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.get('/traffic', deps.getTrafficInsightsController.handle());
  router.get('/vehicles', deps.getVehicleInsightsController.handle());
  router.get('/vehicles/:vehicleId', deps.getVehicleInsightDetailController.handle());
  router.get('/demand', deps.getDemandInsightsController.handle());
  router.get('/leads/:leadId', deps.getLeadJourneyController.handle());

  return router;
}
