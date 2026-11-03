import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetProfitAndLossUseCase } from '../../application/use-cases/get-profit-and-loss.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { reportRangeQuerySchema } from '../schemas/finance-report.schemas';

export class GetProfitAndLossController {
  constructor(private readonly getProfitAndLoss: GetProfitAndLossUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const q = reportRangeQuerySchema.parse(req.query);
        const report = await this.getProfitAndLoss.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            from: q.from,
            to: q.to,
            period: q.period,
            showroomId: q.showroomId ?? null,
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
