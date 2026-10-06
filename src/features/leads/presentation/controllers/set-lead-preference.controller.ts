import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { SetLeadPreferenceUseCase } from '../../application/use-cases/set-lead-preference.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { setLeadPreferenceBodySchema } from '../schemas/set-lead-preference.schemas';

export class SetLeadPreferenceController {
  constructor(private readonly setPreference: SetLeadPreferenceUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = setLeadPreferenceBodySchema.parse(req.body ?? {});
        const result = await this.setPreference.execute({ leadId: params.id, ...body }, ctx);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
