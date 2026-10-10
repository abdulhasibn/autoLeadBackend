import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CancelFollowUpUseCase } from '../../application/use-cases/cancel-follow-up.use-case';
import { followUpParamSchema } from '../schemas/follow-up-actions.schemas';

export class CancelFollowUpController {
  constructor(private readonly cancelFollowUp: CancelFollowUpUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = followUpParamSchema.parse(req.params);
        const followUp = await this.cancelFollowUp.execute(
          { leadId: params.id, followUpId: params.followUpId },
          ctx,
        );
        res.status(200).json(followUp);
      } catch (err) {
        next(err);
      }
    };
  }
}
