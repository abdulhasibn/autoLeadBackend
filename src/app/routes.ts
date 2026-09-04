import { Router } from 'express';

import type { createAuthRouter } from '../features/auth/presentation/auth.routes';

interface RouterDeps {
  readonly authRouter: ReturnType<typeof createAuthRouter>;
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

  return router;
}
