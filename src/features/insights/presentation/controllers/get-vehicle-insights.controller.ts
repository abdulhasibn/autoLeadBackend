import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetVehicleInsightsUseCase } from '../../application/use-cases/get-vehicle-insights.use-case';
import { insightsQuerySchema } from '../schemas/insights.schemas';
import { sendInsights } from './send-insights';

export class GetVehicleInsightsController {
  constructor(private readonly getVehicles: GetVehicleInsightsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = insightsQuerySchema.parse(req.query);
        sendInsights(res, await this.getVehicles.execute(query, ctx));
      } catch (err) {
        next(err);
      }
    };
  }
}
