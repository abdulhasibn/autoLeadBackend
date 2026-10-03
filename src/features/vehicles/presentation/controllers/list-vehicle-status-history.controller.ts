import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehicleStatusHistoryUseCase } from '../../application/use-cases/list-vehicle-status-history.use-case';
import { paginationQuerySchema } from '../schemas/list-vehicles.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ListVehicleStatusHistoryController {
  constructor(private readonly listHistory: ListVehicleStatusHistoryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
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
