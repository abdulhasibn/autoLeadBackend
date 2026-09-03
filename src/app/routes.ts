import { Router } from 'express';

/**
 * Feature routers are mounted here by composition-root.
 */
export function createRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
}
