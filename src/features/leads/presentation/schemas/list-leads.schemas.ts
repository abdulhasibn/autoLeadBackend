import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import { optionalLeadStatusSchema } from './lead-fields.schemas';

export const listLeadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  status: optionalLeadStatusSchema,
  vehicleId: z.string().uuid('vehicleId must be a UUID').optional(),
  assignedTo: z.string().uuid('assignedTo must be a UUID').optional(),
  preferredMakeId: z.string().uuid('preferredMakeId must be a UUID').optional(),
  preferredModelId: z.string().uuid('preferredModelId must be a UUID').optional(),
  preferredVariantId: z.string().uuid('preferredVariantId must be a UUID').optional(),
});
