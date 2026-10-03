import { Router } from 'express';

import type { createAuthRouter } from '../features/auth/presentation/auth.routes';
import type { createOwnersRouter } from '../features/owners/presentation/owners.routes';
import type { createUsersRouter } from '../features/users/presentation/users.routes';

interface RouterDeps {
  readonly authRouter: ReturnType<typeof createAuthRouter>;
  readonly usersRouter: ReturnType<typeof createUsersRouter>;
  readonly ownersRouter: ReturnType<typeof createOwnersRouter>;
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

  return router;
}
