import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { SuggestVehiclesUseCase } from '../../application/use-cases/suggest-vehicles.use-case';
import { suggestVehiclesBodySchema } from '../schemas/suggest-vehicles.schemas';

export class SuggestVehiclesController {
  constructor(private readonly suggestVehicles: SuggestVehiclesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = suggestVehiclesBodySchema.parse(req.body);
        const result = await this.suggestVehicles.execute(body, ctx);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
