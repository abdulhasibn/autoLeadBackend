import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetVehicleProfitReportUseCase } from '../../application/use-cases/get-vehicle-profit-report.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { vehicleProfitQuerySchema } from '../schemas/finance-report.schemas';

export class GetVehicleProfitReportController {
  constructor(private readonly getReport: GetVehicleProfitReportUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const q = vehicleProfitQuerySchema.parse(req.query);
        const report = await this.getReport.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            from: q.from,
            to: q.to,
            showroomId: q.showroomId ?? null,
            sort: q.sort,
          },
          ctx,
        );
        res.status(200).json(report);
      } catch (err) {
        next(err);
      }
    };
  }
}
