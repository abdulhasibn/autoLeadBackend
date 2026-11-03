import cors from 'cors';
import express, { Router } from 'express';

import type { PublicVehiclesController } from './controllers/public-vehicles.controller';
import type { SubmitTestDriveController } from './controllers/submit-test-drive.controller';

// Public bodies are a name and a phone number; anything bigger is abuse.
const PUBLIC_JSON_BODY_LIMIT = '10kb';

export interface MarketplaceRouterDeps {
  /** Browser origins allowed to call these routes; empty allows none. */
  readonly allowedOrigins: readonly string[];
  readonly publicVehiclesController: PublicVehiclesController;
  readonly submitTestDriveController: SubmitTestDriveController;
}

/**
 * Anonymous routes for the customer website (ADR-0010). No bearer middleware:
 * every response here is safe for anyone to read.
 */
export function createMarketplaceRouter(deps: MarketplaceRouterDeps): Router {
  const router = Router();

  router.use(cors({ origin: [...deps.allowedOrigins], methods: ['GET', 'POST'] }));

  router.get('/vehicles', deps.publicVehiclesController.list());
  router.get('/vehicles/:id', deps.publicVehiclesController.get());
  router.get('/filters', deps.publicVehiclesController.filters());
  router.post(
    '/test-drive-requests',
    express.json({ limit: PUBLIC_JSON_BODY_LIMIT }),
    deps.submitTestDriveController.handle(),
  );

  return router;
}
