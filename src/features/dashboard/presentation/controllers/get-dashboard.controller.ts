import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetDashboardUseCase } from '../../application/use-cases/get-dashboard.use-case';
import { getDashboardQuerySchema } from '../schemas/get-dashboard.schemas';

export class GetDashboardController {
  constructor(private readonly getDashboard: GetDashboardUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = getDashboardQuerySchema.parse(req.query);
        const dashboard = await this.getDashboard.execute(
          { period: query.period, showroomId: query.showroomId },
          ctx,
        );
        res.set('Cache-Control', 'private, max-age=30');
        res.status(200).json(dashboard);
      } catch (err) {
        next(err);
      }
    };
  }
}
