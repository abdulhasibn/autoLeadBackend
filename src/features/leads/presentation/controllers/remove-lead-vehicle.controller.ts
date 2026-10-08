import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { RemoveLeadVehicleUseCase } from '../../application/use-cases/remove-lead-vehicle.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';

export class RemoveLeadVehicleController {
  constructor(private readonly removeVehicle: RemoveLeadVehicleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const result = await this.removeVehicle.execute(params.id, ctx);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
