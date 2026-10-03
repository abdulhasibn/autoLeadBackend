import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetVehicleUseCase } from '../../application/use-cases/get-vehicle.use-case';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class GetVehicleController {
  constructor(private readonly getVehicle: GetVehicleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const vehicle = await this.getVehicle.execute(params.id, ctx);
        res.status(200).json(vehicle);
      } catch (err) {
        next(err);
      }
    };
  }
}
