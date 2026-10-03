import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { NotificationInboxPolicy } from './application/policies/notification-inbox.policy';
import { ListNotificationsUseCase } from './application/use-cases/list-notifications.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/mark-notification-read.use-case';
import { SupabaseNotificationQueries } from './infrastructure/supabase-notification.queries';
import { SupabaseNotificationRepository } from './infrastructure/supabase-notification.repository';
import { ListNotificationsController } from './presentation/controllers/list-notifications.controller';
import { MarkNotificationReadController } from './presentation/controllers/mark-notification-read.controller';
import { createNotificationsRouter } from './presentation/notifications.routes';

export interface NotificationsComposition {
  readonly router: ReturnType<typeof createNotificationsRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface NotificationsCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
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

  const router = createNotificationsRouter({
    bearerMiddleware: deps.bearerMiddleware,
    listNotificationsController: new ListNotificationsController(
      new ListNotificationsUseCase(policy, queries, deps.clock),
    ),
    markNotificationReadController: new MarkNotificationReadController(
      new MarkNotificationReadUseCase(policy, repo),
    ),
  });

  const errorMapper: ErrorMapper = () => null;

  return { router, errorMapper };
}
