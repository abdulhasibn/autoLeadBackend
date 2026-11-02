import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { DeleteVehicleQuoteUseCase } from '../../application/use-cases/delete-vehicle-quote.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { vehicleQuoteParamSchema } from '../schemas/vehicle-money.schemas';

export class DeleteVehicleQuoteController {
  constructor(private readonly deleteVehicleQuote: DeleteVehicleQuoteUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleQuoteParamSchema.parse(req.params);
        await this.deleteVehicleQuote.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            vehicleId: params.vehicleId,
            quoteId: params.quoteId,
          },
          ctx,
        );
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    };
  }
}
