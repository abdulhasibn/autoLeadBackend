import type { RequestHandler } from 'express';

import type { UpdateOwnerUseCase } from '../../application/use-cases/update-owner.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { ownerIdParamSchema } from '../schemas/owner-id.schemas';
import { updateOwnerBodySchema } from '../schemas/update-owner.schemas';

export class UpdateOwnerController {
  constructor(private readonly updateOwner: UpdateOwnerUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = ownerIdParamSchema.parse(req.params);
        const body = updateOwnerBodySchema.parse(req.body);
        const owner = await this.updateOwner.execute(
          {
            ownerId: params.id,
            fullName: body.fullName,
            phone: body.phone,
            email: body.email,
            address: body.address,
            city: body.city,
            preferredContactMethod: body.preferredContactMethod,
            altPhone: body.altPhone,
            idInfo: body.idInfo,
            notes: body.notes,
          },
          ctx,
        );
        res.status(200).json(owner);
      } catch (err) {
        next(err);
      }
    };
  }
}
