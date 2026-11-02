import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetVehicleFinanceUseCase } from '../../application/use-cases/get-vehicle-finance.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { vehicleIdParamSchema } from '../schemas/vehicle-money.schemas';

export class GetVehicleFinanceController {
  constructor(private readonly getVehicleFinance: GetVehicleFinanceUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const finance = await this.getVehicleFinance.execute(
          { sessionToken: readFinanceSessionToken(req), vehicleId: params.vehicleId },
          ctx,
        );
        res.status(200).json(finance);
      } catch (err) {
        next(err);
      }
    };
  }
}
