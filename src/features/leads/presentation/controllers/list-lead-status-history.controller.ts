import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListLeadStatusHistoryUseCase } from '../../application/use-cases/list-lead-status-history.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { paginationQuerySchema } from '../schemas/list-leads.schemas';

export class ListLeadStatusHistoryController {
  constructor(private readonly listHistory: ListLeadStatusHistoryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const query = paginationQuerySchema.parse(req.query);
        const page = await this.listHistory.execute(
          params.id,
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
