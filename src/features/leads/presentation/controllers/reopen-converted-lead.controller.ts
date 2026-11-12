import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ReopenConvertedLeadUseCase } from '../../application/use-cases/reopen-converted-lead.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { reopenConvertedLeadBodySchema } from '../schemas/reopen-converted-lead.schemas';

export class ReopenConvertedLeadController {
  constructor(private readonly reopen: ReopenConvertedLeadUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = reopenConvertedLeadBodySchema.parse(req.body ?? {});
        const result = await this.reopen.execute({ leadId: params.id, notes: body.notes }, ctx);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
