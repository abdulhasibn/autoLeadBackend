import { z } from 'zod';

import { staffRoleSchema } from './staff-fields.schemas';

export const replaceStaffRolesBodySchema = z.object({
  roles: z.array(staffRoleSchema).min(1, 'At least one role is required'),
});

export type ReplaceStaffRolesBody = z.infer<typeof replaceStaffRolesBodySchema>;
