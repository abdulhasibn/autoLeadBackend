import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { RecoverVaultUseCase } from '../../application/use-cases/recover-vault.use-case';
import { recoveryKeyBodySchema } from '../schemas/vault-secret.schemas';

export class RecoverVaultController {
  constructor(private readonly recoverVault: RecoverVaultUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = recoveryKeyBodySchema.parse(req.body);
        const keys = await this.recoverVault.execute({ recoveryKey: body.recoveryKey }, ctx);
        res.status(200).json(keys);
      } catch (err) {
        next(err);
      }
    };
  }
}
