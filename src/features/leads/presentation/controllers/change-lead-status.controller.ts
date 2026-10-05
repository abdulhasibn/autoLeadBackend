import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ChangeLeadStatusUseCase } from '../../application/use-cases/change-lead-status.use-case';
import { changeLeadStatusBodySchema } from '../schemas/change-lead-status.schemas';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';

export class ChangeLeadStatusController {
  constructor(private readonly changeStatus: ChangeLeadStatusUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = changeLeadStatusBodySchema.parse(req.body);
        const result = await this.changeStatus.execute(
          { leadId: params.id, status: body.status, notes: body.notes },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
