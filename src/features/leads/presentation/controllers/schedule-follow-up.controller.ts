import type { RequestHandler } from 'express';

import { requireAuth } from '../../../../presentation/http/middleware/require-auth';
import type { ScheduleFollowUpUseCase } from '../../application/use-cases/schedule-follow-up.use-case';
import { leadIdParamSchema } from '../schemas/lead-id.schemas';
import { scheduleFollowUpBodySchema } from '../schemas/schedule-follow-up.schemas';

export class ScheduleFollowUpController {
  constructor(private readonly scheduleFollowUp: ScheduleFollowUpUseCase) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        const ctx = requireAuth(req);
        const params = leadIdParamSchema.parse(req.params);
        const body = scheduleFollowUpBodySchema.parse(req.body);
        const followUp = await this.scheduleFollowUp.execute(
          {
            leadId: params.id,
            scheduledAt: body.scheduledAt,
            taskType: body.taskType,
            notes: body.notes,
          },
          ctx,
        );
        res.status(201).json(followUp);
      } catch (err) {
        next(err);
      }
    };
  }
}
