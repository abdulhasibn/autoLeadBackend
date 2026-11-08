import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetLeadJourneyUseCase } from '../../application/use-cases/get-lead-journey.use-case';
import { leadIdParamsSchema } from '../schemas/insights.schemas';
import { sendInsights } from './send-insights';

export class GetLeadJourneyController {
  constructor(private readonly getJourney: GetLeadJourneyUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const { leadId } = leadIdParamsSchema.parse(req.params);
        sendInsights(res, await this.getJourney.execute(leadId, ctx));
      } catch (err) {
        next(err);
      }
    };
  }
}
