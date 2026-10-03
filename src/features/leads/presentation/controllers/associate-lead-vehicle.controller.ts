import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { AssociateLeadVehicleUseCase } from '../../application/use-cases/associate-lead-vehicle.use-case';
import { associateLeadVehicleBodySchema } from '../schemas/associate-lead-vehicle.schemas';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';

export class AssociateLeadVehicleController {
  constructor(private readonly associateVehicle: AssociateLeadVehicleUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = associateLeadVehicleBodySchema.parse(req.body);
        const result = await this.associateVehicle.execute(
          { leadId: params.id, vehicleId: body.vehicleId },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
