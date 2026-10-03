import { z } from 'zod';

import {
  followUpTaskTypeSchema,
  optionalTextSchema,
  scheduledAtSchema,
} from './lead-fields.schemas';

export const scheduleFollowUpBodySchema = z.object({
  scheduledAt: scheduledAtSchema,
  taskType: followUpTaskTypeSchema,
  notes: optionalTextSchema,
});
