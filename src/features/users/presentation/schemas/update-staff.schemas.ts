import { z } from 'zod';

import { emailSchema, optionalShowroomIdSchema, phoneSchema } from './staff-fields.schemas';

export const updateStaffBodySchema = z.object({
  fullName: z.string({ error: 'fullName is required' }).min(1, 'fullName cannot be empty'),
  phone: phoneSchema,
  email: emailSchema,
  showroomId: optionalShowroomIdSchema,
});

export type UpdateStaffBody = z.infer<typeof updateStaffBodySchema>;
