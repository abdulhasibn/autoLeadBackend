import { Router } from 'express';

import type { createAuthRouter } from '../features/auth/presentation/auth.routes';
import type { createDashboardRouter } from '../features/dashboard/presentation/dashboard.routes';
import type { createCatalogRouter } from '../features/vehicles/presentation/catalog.routes';
import type { createLeadsRouter } from '../features/leads/presentation/leads.routes';
import type { createNotificationsRouter } from '../features/notifications/presentation/notifications.routes';
import type { createOwnersRouter } from '../features/owners/presentation/owners.routes';
import type { createUsersRouter } from '../features/users/presentation/users.routes';
import type { createVehiclesRouter } from '../features/vehicles/presentation/vehicles.routes';

interface RouterDeps {
  readonly authRouter: ReturnType<typeof createAuthRouter>;
  readonly usersRouter: ReturnType<typeof createUsersRouter>;
  readonly ownersRouter: ReturnType<typeof createOwnersRouter>;
  readonly vehiclesRouter: ReturnType<typeof createVehiclesRouter>;
  readonly catalogRouter: ReturnType<typeof createCatalogRouter>;
  readonly leadsRouter: ReturnType<typeof createLeadsRouter>;
  readonly notificationsRouter: ReturnType<typeof createNotificationsRouter>;
  readonly dashboardRouter: ReturnType<typeof createDashboardRouter>;
}

/**
 * Feature routers are mounted here by composition-root.
 */
export function createRouter(deps: RouterDeps): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.use('/auth', deps.authRouter);
  router.use('/users', deps.usersRouter);
  router.use('/owners', deps.ownersRouter);
  router.use('/vehicles', deps.vehiclesRouter);
  router.use('/catalog', deps.catalogRouter);
  router.use('/leads', deps.leadsRouter);
  router.use('/notifications', deps.notificationsRouter);
  router.use('/dashboard', deps.dashboardRouter);

  return router;
}
