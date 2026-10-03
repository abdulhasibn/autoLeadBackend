import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CreateVehicleDocumentUploadUseCase } from '../../application/use-cases/create-vehicle-document-upload.use-case';
import { createDocumentUploadBodySchema } from '../schemas/vehicle-documents.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class CreateVehicleDocumentUploadController {
  constructor(private readonly createUpload: CreateVehicleDocumentUploadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = createDocumentUploadBodySchema.parse(req.body);
        const result = await this.createUpload.execute(
          { vehicleId: params.id, docType: body.docType, contentType: body.contentType },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
