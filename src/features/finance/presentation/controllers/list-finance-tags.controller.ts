import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListFinanceTagsUseCase } from '../../application/use-cases/list-finance-tags.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { listFinanceTagsQuerySchema } from '../schemas/finance-tag.schemas';

export class ListFinanceTagsController {
  constructor(private readonly listTags: ListFinanceTagsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listFinanceTagsQuerySchema.parse(req.query);
        const tags = await this.listTags.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            includeArchived: query.includeArchived ?? false,
          },
          ctx,
        );
        res.status(200).json(tags);
      } catch (err) {
        next(err);
      }
    };
  }
}
