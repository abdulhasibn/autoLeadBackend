import { z } from 'zod';

export const DEFAULT_MIN_MATCH_SCORE = 60;
export const DEFAULT_SUGGESTION_LIMIT = 10;
export const MAX_SUGGESTION_LIMIT = 50;

export const vehicleLeadMatchesParamsSchema = z.object({
  vehicleId: z.string().uuid('vehicleId must be a UUID'),
});

export const vehicleLeadMatchesQuerySchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100).default(DEFAULT_MIN_MATCH_SCORE),
  limit: z.coerce.number().int().min(1).max(MAX_SUGGESTION_LIMIT).default(DEFAULT_SUGGESTION_LIMIT),
});
