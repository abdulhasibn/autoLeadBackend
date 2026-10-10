import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehicleLeadMatchesUseCase } from '../../application/use-cases/list-vehicle-lead-matches.use-case';
import {
  vehicleLeadMatchesParamsSchema,
  vehicleLeadMatchesQuerySchema,
} from '../schemas/list-vehicle-lead-matches.schemas';

export class ListVehicleLeadMatchesController {
  constructor(private readonly listMatches: ListVehicleLeadMatchesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleLeadMatchesParamsSchema.parse(req.params);
        const query = vehicleLeadMatchesQuerySchema.parse(req.query);
        const result = await this.listMatches.execute(
          { vehicleId: params.vehicleId, minScore: query.minScore, limit: query.limit },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
