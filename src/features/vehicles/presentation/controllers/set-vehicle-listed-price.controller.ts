import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { SetVehicleListedPriceUseCase } from '../../application/use-cases/set-vehicle-listed-price.use-case';
import { setListedPriceBodySchema } from '../schemas/set-listed-price.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class SetVehicleListedPriceController {
  constructor(private readonly setListedPrice: SetVehicleListedPriceUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = setListedPriceBodySchema.parse(req.body);
        const result = await this.setListedPrice.execute(params.id, body.listedPrice, ctx);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
