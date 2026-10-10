import { z } from 'zod';

import { newPasswordField } from './password.schemas';

/**
 * Zod schema for POST /auth/change-password.
 * The current password is only checked against the provider, so any
 * non-empty string is accepted here.
 */
export const changePasswordBodySchema = z.object({
  currentPassword: z
    .string({ error: 'currentPassword is required' })
    .min(1, 'currentPassword cannot be empty'),
  newPassword: newPasswordField,
});

export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
