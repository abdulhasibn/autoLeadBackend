import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { RecordVehicleSaleUseCase } from '../../application/use-cases/record-vehicle-sale.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import {
  recordVehicleSaleBodySchema,
  vehicleIdParamSchema,
} from '../schemas/vehicle-money.schemas';

export class RecordVehicleSaleController {
  constructor(private readonly recordVehicleSale: RecordVehicleSaleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = recordVehicleSaleBodySchema.parse(req.body);
        const state = await this.recordVehicleSale.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            vehicleId: params.vehicleId,
            finalisedPricePaise: body.finalisedPrice,
            soldOn: body.soldOn,
            leadId: body.leadId,
          },
          ctx,
        );
        res.status(200).json(state);
      } catch (err) {
        next(err);
      }
    };
  }
}
