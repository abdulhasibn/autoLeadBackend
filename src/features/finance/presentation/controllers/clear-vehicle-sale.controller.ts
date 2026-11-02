import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ClearVehicleSaleUseCase } from '../../application/use-cases/clear-vehicle-sale.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { vehicleIdParamSchema } from '../schemas/vehicle-money.schemas';

export class ClearVehicleSaleController {
  constructor(private readonly clearVehicleSale: ClearVehicleSaleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        await this.clearVehicleSale.execute(
          { sessionToken: readFinanceSessionToken(req), vehicleId: params.vehicleId },
          ctx,
        );
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
