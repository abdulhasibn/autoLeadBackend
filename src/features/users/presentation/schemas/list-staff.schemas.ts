import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import { StaffRole } from '../../domain/staff-role.value-object';
import { staffRoleSchema } from './staff-fields.schemas';

export const listStaffQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  role: staffRoleSchema
    .optional()
    .transform((value) => (value === undefined ? undefined : StaffRole.create(value).name)),
});

export type ListStaffQueryParams = z.infer<typeof listStaffQuerySchema>;
