import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { SetVehicleDealUseCase } from '../../application/use-cases/set-vehicle-deal.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { setVehicleDealBodySchema, vehicleIdParamSchema } from '../schemas/vehicle-money.schemas';

export class SetVehicleDealController {
  constructor(private readonly setVehicleDeal: SetVehicleDealUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = setVehicleDealBodySchema.parse(req.body);
        const state = await this.setVehicleDeal.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            vehicleId: params.vehicleId,
            purchaseRatePaise: body.purchaseRate,
            purchasedOn: body.purchasedOn,
            ownerExpectedPricePaise: body.ownerExpectedPrice,
            minimumSellingPricePaise: body.minimumSellingPrice,
            note: body.note,
            ...(body.listedPrice === undefined ? {} : { listedPricePaise: body.listedPrice }),
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
