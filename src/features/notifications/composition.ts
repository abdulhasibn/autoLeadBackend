import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import type { Logger } from '../../shared/logging/logger.port';
import { NotificationInboxPolicy } from './application/policies/notification-inbox.policy';
import { ListNotificationsUseCase } from './application/use-cases/list-notifications.use-case';
import { DispatchPendingPushesUseCase } from './application/use-cases/dispatch-pending-pushes.use-case';
import { RegisterPushDeviceUseCase } from './application/use-cases/register-push-device.use-case';
import { UnregisterPushDeviceUseCase } from './application/use-cases/unregister-push-device.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/mark-notification-read.use-case';
import { ExpoPushSender } from './infrastructure/expo-push.sender';
import { SupabasePendingPushRepository } from './infrastructure/supabase-pending-push.repository';
import { SupabasePushDeviceRepository } from './infrastructure/supabase-push-device.repository';
import { SupabaseNotificationQueries } from './infrastructure/supabase-notification.queries';
import { SupabaseNotificationRepository } from './infrastructure/supabase-notification.repository';
import { ListNotificationsController } from './presentation/controllers/list-notifications.controller';
import { MarkNotificationReadController } from './presentation/controllers/mark-notification-read.controller';
import { PushDeviceController } from './presentation/controllers/push-device.controller';
import { PushDispatchController } from './presentation/controllers/push-dispatch.controller';
import {
  createNotificationsRouter,
  createPushDispatchRouter,
} from './presentation/notifications.routes';

export interface NotificationsComposition {
  readonly router: ReturnType<typeof createNotificationsRouter>;
  /** Mounted at /internal/push; called by the database, not by users. */
  readonly pushDispatchRouter: ReturnType<typeof createPushDispatchRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface NotificationsCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Shared secret the database sends to trigger a dispatch. Null disables the endpoint. */
  readonly pushDispatchSecret: string | null;
  /** Optional Expo access token, if push security is enabled on the Expo project. */
  readonly expoAccessToken: string | null;
}

/**
 * Constructs and wires the notifications inbox.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeNotifications(
  infraClient: SupabaseClient<Database>,
  deps: NotificationsCompositionDeps,
): NotificationsComposition {
  const policy = new NotificationInboxPolicy();
  const repo = new SupabaseNotificationRepository(infraClient);
  const queries = new SupabaseNotificationQueries(infraClient);

  const devices = new SupabasePushDeviceRepository(infraClient);
  const dispatchPendingPushes = new DispatchPendingPushesUseCase(
    new SupabasePendingPushRepository(infraClient),
    devices,
    new ExpoPushSender(deps.expoAccessToken, deps.logger),
    deps.logger,
  );

  const router = createNotificationsRouter({
    bearerMiddleware: deps.bearerMiddleware,
    listNotificationsController: new ListNotificationsController(
      new ListNotificationsUseCase(policy, queries, deps.clock),
    ),
    markNotificationReadController: new MarkNotificationReadController(
      new MarkNotificationReadUseCase(policy, repo),
    ),
    pushDeviceController: new PushDeviceController(
      new RegisterPushDeviceUseCase(policy, devices),
      new UnregisterPushDeviceUseCase(policy, devices),
    ),
  });
  const pushDispatchRouter = createPushDispatchRouter(
    new PushDispatchController(dispatchPendingPushes, deps.pushDispatchSecret),
  );

  const errorMapper: ErrorMapper = () => null;

  return { router, pushDispatchRouter, errorMapper };
}
