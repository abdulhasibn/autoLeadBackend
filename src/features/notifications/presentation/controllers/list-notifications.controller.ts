import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListNotificationsUseCase } from '../../application/use-cases/list-notifications.use-case';
import { listNotificationsQuerySchema } from '../schemas/list-notifications.schemas';

export class ListNotificationsController {
  constructor(private readonly listNotifications: ListNotificationsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listNotificationsQuerySchema.parse(req.query);
        const page = await this.listNotifications.execute(
          { isRead: query.isRead, page: { limit: query.limit, offset: query.offset } },
          ctx,
        );
        res.status(200).json(page);
      } catch (err) {
        next(err);
      }
    };
  }
}
