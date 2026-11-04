import cors from 'cors';
import express, { Router, type ErrorRequestHandler } from 'express';

import type { IngestEventsController } from './controllers/ingest-events.controller';

// 20 events with a dozen small props each fit comfortably.
const EVENTS_BODY_LIMIT = '16kb';

export interface SiteAnalyticsRouterDeps {
  /** Browser origins allowed to call these routes; empty allows none. */
  readonly allowedOrigins: readonly string[];
  readonly ingestEventsController: IngestEventsController;
}

// An oversized or unparsable body is still a 204: beacons never read the answer.
const swallowBodyErrors: ErrorRequestHandler = (_err, _req, res, _next) => {
  res.status(204).end();
};

/** Anonymous analytics capture for the customer website (ADR-0016). */
export function createSiteAnalyticsRouter(deps: SiteAnalyticsRouterDeps): Router {
  const router = Router();

  router.use('/events', cors({ origin: [...deps.allowedOrigins], methods: ['POST'] }));

  router.post(
    '/events',
    express.json({ limit: EVENTS_BODY_LIMIT }),
    express.text({ type: 'text/plain', limit: EVENTS_BODY_LIMIT }),
    deps.ingestEventsController.handle(),
    swallowBodyErrors,
  );

  return router;
}
