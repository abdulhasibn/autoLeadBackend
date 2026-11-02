import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetFinanceEntryUseCase } from '../../application/use-cases/get-finance-entry.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { financeEntryIdParamSchema } from '../schemas/finance-entry.schemas';

export class GetFinanceEntryController {
  constructor(private readonly getEntry: GetFinanceEntryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = financeEntryIdParamSchema.parse(req.params);
        const entry = await this.getEntry.execute(
          { sessionToken: readFinanceSessionToken(req), entryId: params.id },
          ctx,
        );
        res.status(200).json(entry);
      } catch (err) {
        next(err);
      }
    };
  }
}
