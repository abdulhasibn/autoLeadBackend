import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehicleQuotesUseCase } from '../../application/use-cases/list-vehicle-quotes.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { vehicleIdParamSchema } from '../schemas/vehicle-money.schemas';

export class ListVehicleQuotesController {
  constructor(private readonly listVehicleQuotes: ListVehicleQuotesUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const quotes = await this.listVehicleQuotes.execute(
          { sessionToken: readFinanceSessionToken(req), vehicleId: params.vehicleId },
          ctx,
        );
        res.status(200).json(quotes);
      } catch (err) {
        next(err);
      }
    };
  }
}
