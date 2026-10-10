import { z } from 'zod';

import { leadIdParamSchema } from './lead-id.schemas';
import { followUpOutcomeSchema, optionalTextSchema } from './lead-fields.schemas';
import { paginationQuerySchema } from './list-leads.schemas';
import { scheduleFollowUpBodySchema } from './schedule-follow-up.schemas';

export const followUpParamSchema = leadIdParamSchema.extend({
  followUpId: z.string().uuid('followUpId must be a UUID'),
});

export const completeFollowUpBodySchema = z.object({
  outcome: followUpOutcomeSchema,
  notes: optionalTextSchema,
  next: scheduleFollowUpBodySchema.nullish().transform((value) => value ?? null),
});

export const listFollowUpsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['open', 'closed', 'all']).default('all'),
});
