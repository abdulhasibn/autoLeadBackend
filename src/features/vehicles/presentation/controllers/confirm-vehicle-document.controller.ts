import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ConfirmVehicleDocumentUseCase } from '../../application/use-cases/confirm-vehicle-document.use-case';
import { confirmDocumentBodySchema } from '../schemas/vehicle-documents.schemas';
import { vehicleIdParamSchema } from '../schemas/vehicle-id.schemas';

export class ConfirmVehicleDocumentController {
  constructor(private readonly confirmDocument: ConfirmVehicleDocumentUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = vehicleIdParamSchema.parse(req.params);
        const body = confirmDocumentBodySchema.parse(req.body);
        const result = await this.confirmDocument.execute(
          {
            vehicleId: params.id,
            storagePath: body.storagePath,
            docType: body.docType,
            fileName: body.fileName,
          },
          ctx,
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
