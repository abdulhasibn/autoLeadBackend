import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { DeleteVehicleDocumentUseCase } from '../../application/use-cases/delete-vehicle-document.use-case';
import { documentIdParamSchema } from '../schemas/vehicle-documents.schemas';

export class DeleteVehicleDocumentController {
  constructor(private readonly deleteDocument: DeleteVehicleDocumentUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = documentIdParamSchema.parse(req.params);
        await this.deleteDocument.execute(params.id, params.documentId, ctx);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    };
  }
}
