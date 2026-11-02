import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetVaultStatusUseCase } from '../../application/use-cases/get-vault-status.use-case';
import { readFinanceSessionToken } from '../finance-session-token';

export class GetVaultStatusController {
  constructor(private readonly getVaultStatus: GetVaultStatusUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const status = await this.getVaultStatus.execute(readFinanceSessionToken(req), ctx);
        res.status(200).json(status);
      } catch (err) {
        next(err);
      }
    };
  }
}
