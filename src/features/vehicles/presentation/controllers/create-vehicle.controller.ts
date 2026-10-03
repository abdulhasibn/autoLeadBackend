import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CreateVehicleUseCase } from '../../application/use-cases/create-vehicle.use-case';
import { createVehicleBodySchema } from '../schemas/create-vehicle.schemas';

export class CreateVehicleController {
  constructor(private readonly createVehicle: CreateVehicleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const body = createVehicleBodySchema.parse(req.body);
        const vehicle = await this.createVehicle.execute(body, ctx);
        res.status(201).json(vehicle);
      } catch (err) {
        next(err);
      }
    };
  }
}
