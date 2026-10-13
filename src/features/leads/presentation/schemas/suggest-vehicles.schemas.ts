import { z } from 'zod';

import {
  leadPreferenceShape,
  optionalBudgetSchema,
  refineLeadPreference,
} from './lead-fields.schemas';
import {
  DEFAULT_MIN_MATCH_SCORE,
  DEFAULT_SUGGESTION_LIMIT,
  MAX_SUGGESTION_LIMIT,
} from './match-query.schemas';

export const suggestVehiclesBodySchema = z
  .object({
    showroomId: z
      .string()
      .uuid('showroomId must be a UUID')
      .nullable()
      .optional()
      .transform((val) => val ?? null),
    budget: optionalBudgetSchema,
    ...leadPreferenceShape,
    minScore: z.number().int().min(0).max(100).optional().default(DEFAULT_MIN_MATCH_SCORE),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_SUGGESTION_LIMIT)
      .optional()
      .default(DEFAULT_SUGGESTION_LIMIT),
  })
  .superRefine(refineLeadPreference);
