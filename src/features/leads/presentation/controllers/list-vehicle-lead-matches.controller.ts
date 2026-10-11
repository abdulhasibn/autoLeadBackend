import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehicleLeadMatchesUseCase } from '../../application/use-cases/list-vehicle-lead-matches.use-case';
import { matchQuerySchema, vehicleLeadMatchesParamsSchema } from '../schemas/match-query.schemas';

export class ListVehicleLeadMatchesController {
  constructor(private readonly listMatches: ListVehicleLeadMatchesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleLeadMatchesParamsSchema.parse(req.params);
        const query = matchQuerySchema.parse(req.query);
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
