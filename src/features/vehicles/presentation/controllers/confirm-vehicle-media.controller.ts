import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ConfirmVehicleMediaUseCase } from '../../application/use-cases/confirm-vehicle-media.use-case';
import { confirmMediaBodySchema } from '../schemas/vehicle-media.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ConfirmVehicleMediaController {
  constructor(private readonly confirmMedia: ConfirmVehicleMediaUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = confirmMediaBodySchema.parse(req.body);
        const result = await this.confirmMedia.execute(
          {
            vehicleId: params.id,
            storagePath: body.storagePath,
            category: body.category,
            sortOrder: body.sortOrder,
          },
          ctx,
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
