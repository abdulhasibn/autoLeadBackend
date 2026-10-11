import { z } from 'zod';

import { emailField, newPasswordField, resetCodeField } from './password.schemas';

/** Zod schema for POST /auth/reset-password. */
export const resetPasswordBodySchema = z.object({
  email: emailField,
  code: resetCodeField,
  newPassword: newPasswordField,
});

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
