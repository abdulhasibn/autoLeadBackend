import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { LockVaultUseCase } from '../../application/use-cases/lock-vault.use-case';
import { readFinanceSessionToken } from '../finance-session-token';

export class LockVaultController {
  constructor(private readonly lockVault: LockVaultUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        await this.lockVault.execute(readFinanceSessionToken(req), ctx);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
