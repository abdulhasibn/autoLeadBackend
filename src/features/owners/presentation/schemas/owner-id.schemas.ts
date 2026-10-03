import { z } from 'zod';

export const ownerIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});
