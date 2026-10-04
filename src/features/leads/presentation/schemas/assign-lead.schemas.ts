import { z } from 'zod';

export const assignLeadBodySchema = z.object({
  assignedTo: z
    .string({ error: 'assignedTo is required' })
    .uuid('assignedTo must be a UUID')
    .nullable(),
});
