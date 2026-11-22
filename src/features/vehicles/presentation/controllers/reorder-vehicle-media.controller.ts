import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ReorderVehicleMediaUseCase } from '../../application/use-cases/reorder-vehicle-media.use-case';
import { reorderMediaBodySchema } from '../schemas/vehicle-media.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ReorderVehicleMediaController {
  constructor(private readonly reorderMedia: ReorderVehicleMediaUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = reorderMediaBodySchema.parse(req.body);
        await this.reorderMedia.execute(params.id, body.items, ctx);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };
  }
}
