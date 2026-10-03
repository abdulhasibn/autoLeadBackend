import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { DeleteVehicleMediaUseCase } from '../../application/use-cases/delete-vehicle-media.use-case';
import { mediaIdParamSchema } from '../schemas/vehicle-media.schemas';

export class DeleteVehicleMediaController {
  constructor(private readonly deleteMedia: DeleteVehicleMediaUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = mediaIdParamSchema.parse(req.params);
        await this.deleteMedia.execute(params.id, params.mediaId, ctx);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };
  }
}
