import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { MarkNotificationReadUseCase } from '../../application/use-cases/mark-notification-read.use-case';
import { notificationIdParamSchema } from '../schemas/list-notifications.schemas';

export class MarkNotificationReadController {
  constructor(private readonly markRead: MarkNotificationReadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = notificationIdParamSchema.parse(req.params);
        await this.markRead.execute(params.id, ctx);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };
  }
}
