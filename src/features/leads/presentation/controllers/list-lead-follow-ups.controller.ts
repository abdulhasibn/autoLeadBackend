import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListLeadFollowUpsUseCase } from '../../application/use-cases/list-lead-follow-ups.use-case';
import { listFollowUpsQuerySchema } from '../schemas/follow-up-actions.schemas';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';

export class ListLeadFollowUpsController {
  constructor(private readonly listFollowUps: ListLeadFollowUpsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const query = listFollowUpsQuerySchema.parse(req.query);
        const page = await this.listFollowUps.execute(
          params.id,
          query.status,
          { limit: query.limit, offset: query.offset },
          ctx,
        );
        res.status(200).json(page);
      } catch (err) {
        next(err);
      }
    };
  }
}
