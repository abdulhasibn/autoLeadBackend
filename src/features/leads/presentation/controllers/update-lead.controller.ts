import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { UpdateLeadUseCase } from '../../application/use-cases/update-lead.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { updateLeadBodySchema } from '../schemas/update-lead.schemas';

export class UpdateLeadController {
  constructor(private readonly updateLead: UpdateLeadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = updateLeadBodySchema.parse(req.body ?? {});
        const result = await this.updateLead.execute({ leadId: params.id, ...body }, ctx);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
