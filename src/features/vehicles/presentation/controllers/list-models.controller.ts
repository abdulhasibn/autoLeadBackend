import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListModelsUseCase } from '../../application/use-cases/list-models.use-case';
import { paginationQuerySchema } from '../schemas/list-vehicles.schemas';
import { makeIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ListModelsController {
  constructor(private readonly listModels: ListModelsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = makeIdParamSchema.parse(req.params);
        const query = paginationQuerySchema.parse(req.query);
        const page = await this.listModels.execute(
          params.makeId,
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
