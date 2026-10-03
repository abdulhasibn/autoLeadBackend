import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { UpdateVehicleUseCase } from '../../application/use-cases/update-vehicle.use-case';
import { updateVehicleBodySchema } from '../schemas/update-vehicle.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class UpdateVehicleController {
  constructor(private readonly updateVehicle: UpdateVehicleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = updateVehicleBodySchema.parse(req.body);
        const vehicle = await this.updateVehicle.execute({ vehicleId: params.id, ...body }, ctx);
        res.status(200).json(vehicle);
      } catch (err) {
        next(err);
      }
    };
  }
}
