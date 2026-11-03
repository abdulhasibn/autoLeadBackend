import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehicleFinanceSummariesUseCase } from '../../application/use-cases/list-vehicle-finance-summaries.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { vehicleFinanceSummariesQuerySchema } from '../schemas/vehicle-money.schemas';

export class ListVehicleFinanceSummariesController {
  constructor(private readonly listSummaries: ListVehicleFinanceSummariesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const query = vehicleFinanceSummariesQuerySchema.parse(req.query);
        const summaries = await this.listSummaries.execute(
          { sessionToken: readFinanceSessionToken(req), vehicleIds: query.vehicleIds ?? [] },
          ctx,
        );
        res.status(200).json(summaries);
      } catch (err) {
        next(err);
      }
    };
  }
}
