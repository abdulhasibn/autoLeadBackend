import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { SetupVaultUseCase } from '../../application/use-cases/setup-vault.use-case';

export class SetupVaultController {
  constructor(private readonly setupVault: SetupVaultUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const keys = await this.setupVault.execute(ctx);
        res.status(201).json(keys);
      } catch (err) {
        next(err);
      }
    };
  }
}
