import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListShowroomsUseCase } from '../../application/use-cases/list-showrooms.use-case';
import { listShowroomsQuerySchema } from '../schemas/list-showrooms.schemas';

export class ListShowroomsController {
  constructor(private readonly listShowrooms: ListShowroomsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listShowroomsQuerySchema.parse(req.query);
        const page = await this.listShowrooms.execute(
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
