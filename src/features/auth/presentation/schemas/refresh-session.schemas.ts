import { z } from 'zod';

/**
 * Zod schema for POST /auth/refresh.
 * Refresh tokens are opaque provider strings — no domain VO.
 */
export const refreshSessionBodySchema = z.object({
  refreshToken: z
    .string({ error: 'refreshToken is required' })
    .min(1, 'refreshToken cannot be empty'),
});

export type RefreshSessionBody = z.infer<typeof refreshSessionBodySchema>;
