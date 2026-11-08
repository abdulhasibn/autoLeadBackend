import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetDemandInsightsUseCase } from '../../application/use-cases/get-demand-insights.use-case';
import { insightsQuerySchema } from '../schemas/insights.schemas';
import { sendInsights } from './send-insights';

export class GetDemandInsightsController {
  constructor(private readonly getDemand: GetDemandInsightsUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = insightsQuerySchema.parse(req.query);
        sendInsights(res, await this.getDemand.execute(query, ctx));
      } catch (err) {
        next(err);
      }
    };
  }
}
