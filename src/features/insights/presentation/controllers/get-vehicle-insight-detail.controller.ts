import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetVehicleInsightDetailUseCase } from '../../application/use-cases/get-vehicle-insight-detail.use-case';
import { insightsQuerySchema, vehicleIdParamsSchema } from '../schemas/insights.schemas';
import { sendInsights } from './send-insights';

export class GetVehicleInsightDetailController {
  constructor(private readonly getDetail: GetVehicleInsightDetailUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const { vehicleId } = vehicleIdParamsSchema.parse(req.params);
        const query = insightsQuerySchema.parse(req.query);
        sendInsights(res, await this.getDetail.execute({ ...query, vehicleId }, ctx));
      } catch (err) {
        next(err);
      }
    };
  }
}
