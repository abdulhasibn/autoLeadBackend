import type { RequestHandler } from 'express';

import type { ListOwnersUseCase } from '../../application/use-cases/list-owners.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { listOwnersQuerySchema } from '../schemas/list-owners.schemas';

export class ListOwnersController {
  constructor(private readonly listOwners: ListOwnersUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listOwnersQuerySchema.parse(req.query);
        const page = await this.listOwners.execute(
          {
            city: query.city,
            phone: query.phone,
            page: { limit: query.limit, offset: query.offset },
          },
          ctx,
        );
        res.status(200).json(page);
      } catch (err) {
        next(err);
      }
    };
  }
}
