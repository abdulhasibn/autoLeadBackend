import { z } from 'zod';

import {
  emailSchema,
  optionalShowroomIdSchema,
  passwordSchema,
  phoneSchema,
  staffRoleSchema,
} from './staff-fields.schemas';

export const createStaffBodySchema = z.object({
  fullName: z.string({ error: 'fullName is required' }).min(1, 'fullName cannot be empty'),
  phone: phoneSchema,
  email: emailSchema,
  password: passwordSchema,
  showroomId: optionalShowroomIdSchema,
  roles: z.array(staffRoleSchema).min(1, 'At least one role is required'),
});

export type CreateStaffBody = z.infer<typeof createStaffBodySchema>;
