import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { CompleteFollowUpUseCase } from '../../application/use-cases/complete-follow-up.use-case';
import {
  completeFollowUpBodySchema,
  followUpParamSchema,
} from '../schemas/follow-up-actions.schemas';

export class CompleteFollowUpController {
  constructor(private readonly completeFollowUp: CompleteFollowUpUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = followUpParamSchema.parse(req.params);
        const body = completeFollowUpBodySchema.parse(req.body);
        const result = await this.completeFollowUp.execute(
          {
            leadId: params.id,
            followUpId: params.followUpId,
            outcome: body.outcome,
            notes: body.notes,
            next: body.next,
          },
          ctx,
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    };
  }
}
