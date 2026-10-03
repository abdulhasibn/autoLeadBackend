import { z } from 'zod';

import { Email } from '../../../../domain/shared/email.value-object';
import { Password } from '../../../../domain/shared/password.value-object';

/**
 * Zod schema for POST /auth/login.
 * Delegates email and password rules to VOs via superRefine (architecture.md §14).
 */
export const loginBodySchema = z.object({
  email: z.string({ error: 'email is required' }).superRefine((val, ctx) => {
    try {
      Email.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid email',
      });
    }
  }),
  password: z.string({ error: 'password is required' }).superRefine((val, ctx) => {
    try {
      Password.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid password',
      });
    }
  }),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
