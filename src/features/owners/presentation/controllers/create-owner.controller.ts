import type { RequestHandler } from 'express';

import type { CreateOwnerUseCase } from '../../application/use-cases/create-owner.use-case';
import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import { createOwnerBodySchema } from '../schemas/create-owner.schemas';

export class CreateOwnerController {
  constructor(private readonly createOwner: CreateOwnerUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = createOwnerBodySchema.parse(req.body);
        const owner = await this.createOwner.execute(
          {
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
        res.status(201).json(owner);
      } catch (err) {
        next(err);
      }
    };
  }
}
