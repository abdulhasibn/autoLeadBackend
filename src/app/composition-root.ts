import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { SupabaseClient } from '@supabase/supabase-js';

import { JSON_BODY_LIMIT } from '../config/constants';
import type { AppConfig } from '../config/environment';
import { composeAuth } from '../features/auth/composition';
import { composeLeads } from '../features/leads/composition';
import { composeNotifications } from '../features/notifications/composition';
import { composeOwners } from '../features/owners/composition';
import { composeUsers } from '../features/users/composition';
import { composeVehicles } from '../features/vehicles/composition';
import { createLogger } from '../infrastructure/logging/logger';
import { createRequestLoggerMiddleware } from '../infrastructure/logging/request-logger.middleware';
import type { Database } from '../infrastructure/supabase/database.types';
import {
  createSupabaseAuthClient,
  createSupabaseInfraClient,
} from '../infrastructure/supabase/supabase-client';
import { createErrorHandlerMiddleware } from '../presentation/http/errors/error-handler.middleware';
import { createServerTimingMiddleware } from '../presentation/http/middleware/server-timing.middleware';
import { notFoundMiddleware } from '../presentation/http/middleware/not-found.middleware';
import { SystemClock } from '../shared/clock/clock';
import type { Logger } from '../shared/logging/logger.port';
import { createRouter } from './routes';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly supabaseClient: SupabaseClient<Database>;
  readonly bearerMiddleware: RequestHandler;
  readonly app: Express;
}

/**
 * The composition root (architecture.md §11). This is the only module allowed
 * to construct concrete implementations from every layer and wire them
 * together.
 */
export function composeApp(config: AppConfig): AppDependencies {
  const logger = createLogger(config);
  const supabaseClient = createSupabaseInfraClient(config);
  const authClient = createSupabaseAuthClient(config);

  // Feature compositions
  const clock = new SystemClock();
  const auth = composeAuth(supabaseClient, authClient);
  const users = composeUsers(supabaseClient, {
    bearerMiddleware: auth.bearerMiddleware,
    clock,
  });
  const owners = composeOwners(supabaseClient, {
    bearerMiddleware: auth.bearerMiddleware,
    clock,
  });
  // Vehicles and leads depend on each other at runtime (ADR-0011). Vehicles is
  // composed first, so its ILinkedLeads port resolves `leads` per call.
  const vehicles = composeVehicles(supabaseClient, {
    bearerMiddleware: auth.bearerMiddleware,
    clock,
    registeredOwnerLookup: { isLive: owners.isLiveOwner },
    linkedLeads: {
      countActive: (vehicleId) => leads.linkedLeads.countActive(vehicleId),
      unlinkAll: (vehicleId, actorId) => leads.linkedLeads.unlinkAll(vehicleId, actorId),
    },
  });
  const leads = composeLeads(supabaseClient, {
    bearerMiddleware: auth.bearerMiddleware,
    clock,
    linkableVehicleLookup: vehicles.vehicleLeadLink,
    vehicleLinkSync: vehicles.vehicleLeadLink,
    vehicleSale: vehicles.vehicleLeadLink,
  });
  const notifications = composeNotifications(supabaseClient, {
    bearerMiddleware: auth.bearerMiddleware,
    clock,
  });

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(createServerTimingMiddleware());
  app.use(createRequestLoggerMiddleware(logger));

  app.use(
    createRouter({
      authRouter: auth.router,
      usersRouter: users.router,
      ownersRouter: owners.router,
      vehiclesRouter: vehicles.vehiclesRouter,
      catalogRouter: vehicles.catalogRouter,
      leadsRouter: leads.router,
      notificationsRouter: notifications.router,
    }),
  );

  app.use(notFoundMiddleware);
  app.use(
    createErrorHandlerMiddleware(logger, [
      auth.errorMapper,
      users.errorMapper,
      owners.errorMapper,
      vehicles.errorMapper,
      leads.errorMapper,
      notifications.errorMapper,
    ]),
  );

  return { config, logger, supabaseClient, bearerMiddleware: auth.bearerMiddleware, app };
}
