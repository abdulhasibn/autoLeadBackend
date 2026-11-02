import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ChangeFinanceKeyUseCase } from '../../application/use-cases/change-finance-key.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { changeFinanceKeyBodySchema } from '../schemas/vault-secret.schemas';

export class ChangeFinanceKeyController {
  constructor(private readonly changeFinanceKey: ChangeFinanceKeyUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = changeFinanceKeyBodySchema.parse(req.body);
        const result = await this.changeFinanceKey.execute(
          { sessionToken: readFinanceSessionToken(req), currentKey: body.currentKey },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
