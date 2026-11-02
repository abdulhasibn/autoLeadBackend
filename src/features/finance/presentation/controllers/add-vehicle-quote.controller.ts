import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { AddVehicleQuoteUseCase } from '../../application/use-cases/add-vehicle-quote.use-case';
import { readFinanceSessionToken } from '../finance-session-token';
import { addVehicleQuoteBodySchema, vehicleIdParamSchema } from '../schemas/vehicle-money.schemas';

export class AddVehicleQuoteController {
  constructor(private readonly addVehicleQuote: AddVehicleQuoteUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = addVehicleQuoteBodySchema.parse(req.body);
        const quote = await this.addVehicleQuote.execute(
          {
            sessionToken: readFinanceSessionToken(req),
            vehicleId: params.vehicleId,
            amountPaise: body.amount,
            quotedOn: body.quotedOn,
            leadId: body.leadId,
            quotedTo: body.quotedTo,
            note: body.note,
          },
          ctx,
        );
        res.status(201).json(quote);
      } catch (err) {
        next(err);
      }
    };
  }
}
