import type { RequestHandler } from 'express';

import type { GetOwnerUseCase } from '../../application/use-cases/get-owner.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { ownerIdParamSchema } from '../schemas/owner-id.schemas';

export class GetOwnerController {
  constructor(private readonly getOwner: GetOwnerUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = ownerIdParamSchema.parse(req.params);
        const owner = await this.getOwner.execute(params.id, ctx);
        res.status(200).json(owner);
      } catch (err) {
        next(err);
      }
    };
  }
}
