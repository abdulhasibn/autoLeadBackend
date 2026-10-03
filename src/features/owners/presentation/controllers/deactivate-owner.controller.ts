import type { RequestHandler } from 'express';

import type { DeactivateOwnerUseCase } from '../../application/use-cases/deactivate-owner.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { ownerIdParamSchema } from '../schemas/owner-id.schemas';

export class DeactivateOwnerController {
  constructor(private readonly deactivateOwner: DeactivateOwnerUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = ownerIdParamSchema.parse(req.params);
        await this.deactivateOwner.execute(params.id, ctx);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
