import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListLeadVehicleMatchesUseCase } from '../../application/use-cases/list-lead-vehicle-matches.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { matchQuerySchema } from '../schemas/match-query.schemas';

export class ListLeadVehicleMatchesController {
  constructor(private readonly listMatches: ListLeadVehicleMatchesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const query = matchQuerySchema.parse(req.query);
        const result = await this.listMatches.execute(
          { leadId: params.id, minScore: query.minScore, limit: query.limit },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
