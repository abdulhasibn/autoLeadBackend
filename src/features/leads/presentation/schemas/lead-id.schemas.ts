import { z } from 'zod';

export const leadIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});
