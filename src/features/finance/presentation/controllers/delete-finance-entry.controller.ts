import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { DeleteFinanceEntryUseCase } from '../../application/use-cases/delete-finance-entry.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { financeEntryIdParamSchema } from '../schemas/finance-entry.schemas';

export class DeleteFinanceEntryController {
  constructor(private readonly deleteEntry: DeleteFinanceEntryUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = financeEntryIdParamSchema.parse(req.params);
        await this.deleteEntry.execute(
          { sessionToken: readFinanceSessionToken(req), entryId: params.id },
          ctx,
        );
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
