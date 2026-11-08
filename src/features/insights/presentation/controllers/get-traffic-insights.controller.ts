import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetTrafficInsightsUseCase } from '../../application/use-cases/get-traffic-insights.use-case';
import { insightsQuerySchema } from '../schemas/insights.schemas';
import { sendInsights } from './send-insights';

export class GetTrafficInsightsController {
  constructor(private readonly getTraffic: GetTrafficInsightsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = insightsQuerySchema.parse(req.query);
        sendInsights(res, await this.getTraffic.execute(query, ctx));
      } catch (err) {
        next(err);
      }
    };
  }
}
