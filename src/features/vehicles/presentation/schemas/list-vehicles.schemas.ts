import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import {
  optionalRegistrationFilterSchema,
  optionalVehicleStatusSchema,
} from './vehicle-fields.schemas';

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listVehiclesQuerySchema = paginationQuerySchema.extend({
  status: optionalVehicleStatusSchema,
  ownerId: z.string().uuid('ownerId must be a UUID').optional(),
  showroomId: z.string().uuid('showroomId must be a UUID').optional(),
  registration: optionalRegistrationFilterSchema,
});

export type ListVehiclesQueryParams = z.infer<typeof listVehiclesQuerySchema>;
