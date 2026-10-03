import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { GetLeadUseCase } from '../../application/use-cases/get-lead.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';

export class GetLeadController {
  constructor(private readonly getLead: GetLeadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const lead = await this.getLead.execute(params.id, ctx);
        res.status(200).json(lead);
      } catch (err) {
        next(err);
      }
    };
  }
}
