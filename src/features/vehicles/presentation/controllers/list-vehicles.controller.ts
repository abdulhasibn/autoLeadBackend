import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehiclesUseCase } from '../../application/use-cases/list-vehicles.use-case';
import { listVehiclesQuerySchema } from '../schemas/list-vehicles.schemas';

export class ListVehiclesController {
  constructor(private readonly listVehicles: ListVehiclesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = listVehiclesQuerySchema.parse(req.query);
        const page = await this.listVehicles.execute(
          {
            status: query.status,
            ownerId: query.ownerId,
            showroomId: query.showroomId,
            registration: query.registration,
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
