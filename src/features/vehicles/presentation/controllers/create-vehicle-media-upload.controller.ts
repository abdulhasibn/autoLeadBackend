import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CreateVehicleMediaUploadUseCase } from '../../application/use-cases/create-vehicle-media-upload.use-case';
import { createMediaUploadBodySchema } from '../schemas/vehicle-media.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class CreateVehicleMediaUploadController {
  constructor(private readonly createUpload: CreateVehicleMediaUploadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = createMediaUploadBodySchema.parse(req.body);
        const result = await this.createUpload.execute(
          { vehicleId: params.id, category: body.category, contentType: body.contentType },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
