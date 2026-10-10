import { z } from 'zod';

import { emailField } from './password.schemas';

/** Zod schema for POST /auth/forgot-password. */
export const forgotPasswordBodySchema = z.object({
  email: emailField,
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
