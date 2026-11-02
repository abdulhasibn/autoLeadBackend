import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ListVehiclesAwaitingSalePriceUseCase } from '../../application/use-cases/list-vehicles-awaiting-sale-price.use-case';
import { readFinanceSessionToken } from '../finance-session-token';

export class ListVehiclesAwaitingSalePriceController {
  constructor(private readonly listAwaiting: ListVehiclesAwaitingSalePriceUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const cars = await this.listAwaiting.execute(
          { sessionToken: readFinanceSessionToken(req) },
          ctx,
        );
        res.status(200).json(cars);
      } catch (err) {
        next(err);
      }
    };
  }
}
