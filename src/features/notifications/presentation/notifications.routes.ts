import { Router, type RequestHandler } from 'express';

import type { ListNotificationsController } from './controllers/list-notifications.controller';
import type { MarkNotificationReadController } from './controllers/mark-notification-read.controller';

export interface NotificationsRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly listNotificationsController: ListNotificationsController;
  readonly markNotificationReadController: MarkNotificationReadController;
}

export function createNotificationsRouter(deps: NotificationsRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.get('/', deps.listNotificationsController.handle());
  router.patch('/:id/read', deps.markNotificationReadController.handle());

  return router;
}
