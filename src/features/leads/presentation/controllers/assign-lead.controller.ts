import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { AssignLeadUseCase } from '../../application/use-cases/assign-lead.use-case';
import { assignLeadBodySchema } from '../schemas/assign-lead.schemas';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';

export class AssignLeadController {
  constructor(private readonly assignLead: AssignLeadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = assignLeadBodySchema.parse(req.body);
        const result = await this.assignLead.execute(
          { leadId: params.id, assignedTo: body.assignedTo },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
