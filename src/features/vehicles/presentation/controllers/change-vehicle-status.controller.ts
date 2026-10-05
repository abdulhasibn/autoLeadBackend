import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ChangeVehicleStatusUseCase } from '../../application/use-cases/change-vehicle-status.use-case';
import { changeVehicleStatusBodySchema } from '../schemas/change-vehicle-status.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ChangeVehicleStatusController {
  constructor(private readonly changeStatus: ChangeVehicleStatusUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = changeVehicleStatusBodySchema.parse(req.body);
        const result = await this.changeStatus.execute(
          {
            vehicleId: params.id,
            status: body.status,
            reason: body.reason,
            confirmUnlinkLeads: body.confirmUnlinkLeads,
          },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
