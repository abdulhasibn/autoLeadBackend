import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListMakesUseCase } from '../../application/use-cases/list-makes.use-case';
import { paginationQuerySchema } from '../schemas/list-vehicles.schemas';

export class ListMakesController {
  constructor(private readonly listMakes: ListMakesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = paginationQuerySchema.parse(req.query);
        const page = await this.listMakes.execute(
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
