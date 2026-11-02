import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ConfirmVaultUseCase } from '../../application/use-cases/confirm-vault.use-case';
import { recoveryKeyBodySchema } from '../schemas/vault-secret.schemas';

export class ConfirmVaultController {
  constructor(private readonly confirmVault: ConfirmVaultUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = recoveryKeyBodySchema.parse(req.body);
        const status = await this.confirmVault.execute({ recoveryKey: body.recoveryKey }, ctx);
        res.status(200).json(status);
      } catch (err) {
        next(err);
      }
    };
  }
}
