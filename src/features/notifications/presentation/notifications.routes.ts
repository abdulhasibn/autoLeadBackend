import { Router, type RequestHandler } from 'express';

import type { ListNotificationsController } from './controllers/list-notifications.controller';
import type { MarkNotificationReadController } from './controllers/mark-notification-read.controller';
import type { PushDeviceController } from './controllers/push-device.controller';
import type { PushDispatchController } from './controllers/push-dispatch.controller';

export interface NotificationsRouterDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly listNotificationsController: ListNotificationsController;
  readonly markNotificationReadController: MarkNotificationReadController;
  readonly pushDeviceController: PushDeviceController;
}

export function createNotificationsRouter(deps: NotificationsRouterDeps): Router {
  const router = Router();

  router.use(deps.bearerMiddleware);

  router.get('/', deps.listNotificationsController.handle());
  // This device's push token: PUT saves it or flips the in-app switch, DELETE forgets it.
  router.put('/push-devices', deps.pushDeviceController.handleRegister());
  router.delete('/push-devices', deps.pushDeviceController.handleUnregister());
  router.patch('/:id/read', deps.markNotificationReadController.handle());

  return router;
}

/** Database-to-API hook, authenticated by a shared secret rather than a user. */
export function createPushDispatchRouter(controller: PushDispatchController): Router {
  const router = Router();
  router.post('/dispatch', controller.handle());
  return router;
}
