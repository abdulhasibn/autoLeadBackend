import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVariantsUseCase } from '../../application/use-cases/list-variants.use-case';
import { paginationQuerySchema } from '../schemas/list-vehicles.schemas';
import { modelIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ListVariantsController {
  constructor(private readonly listVariants: ListVariantsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = modelIdParamSchema.parse(req.params);
        const query = paginationQuerySchema.parse(req.query);
        const page = await this.listVariants.execute(
          params.modelId,
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
