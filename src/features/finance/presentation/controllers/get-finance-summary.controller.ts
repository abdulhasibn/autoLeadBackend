import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetFinanceSummaryUseCase } from '../../application/use-cases/get-finance-summary.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { showroomQuerySchema } from '../schemas/finance-report.schemas';

export class GetFinanceSummaryController {
  constructor(private readonly getReport: GetFinanceSummaryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const q = showroomQuerySchema.parse(req.query);
        const report = await this.getReport.execute(
          { sessionToken: readFinanceSessionToken(req), showroomId: q.showroomId ?? null },
          ctx,
        );
        res.status(200).json(report);
      } catch (err) {
        next(err);
      }
    };
  }
}
