import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { UnlockVaultUseCase } from '../../application/use-cases/unlock-vault.use-case';
import { unlockVaultBodySchema } from '../schemas/vault-secret.schemas';

export class UnlockVaultController {
  constructor(private readonly unlockVault: UnlockVaultUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = unlockVaultBodySchema.parse(req.body);
        const session = await this.unlockVault.execute({ financeKey: body.financeKey }, ctx);
        res.status(200).json(session);
      } catch (err) {
        next(err);
      }
    };
  }
}
