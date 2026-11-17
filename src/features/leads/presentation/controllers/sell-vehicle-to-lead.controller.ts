import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { SellVehicleToLeadUseCase } from '../../application/use-cases/sell-vehicle-to-lead.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { sellVehicleToLeadBodySchema } from '../schemas/sell-vehicle-to-lead.schemas';

export class SellVehicleToLeadController {
  constructor(private readonly sell: SellVehicleToLeadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = sellVehicleToLeadBodySchema.parse(req.body);
        const result = await this.sell.execute(
          { leadId: params.id, vehicleId: body.vehicleId, notes: body.notes },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
