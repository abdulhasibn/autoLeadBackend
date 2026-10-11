import { z } from 'zod';

/**
 * Zod schema for POST /auth/logout. The body is optional: no body signs out
 * this device only.
 */
export const logoutBodySchema = z
  .object({
    scope: z.enum(['local', 'global']).default('local'),
  })
  .default({ scope: 'local' });

export type LogoutBody = z.infer<typeof logoutBodySchema>;
