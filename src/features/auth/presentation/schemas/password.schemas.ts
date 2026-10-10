import { z } from 'zod';

import { Email } from '../../../../domain/shared/email.value-object';
import { Password } from '../../../../domain/shared/password.value-object';
import { ResetCode } from '../../domain/reset-code.value-object';

/**
 * Field schemas shared by the password bodies. Each delegates its rule to the
 * value object via superRefine (architecture.md §14).
 */
function delegateTo(create: (value: string) => unknown, field: string) {
  return z.string({ error: `${field} is required` }).superRefine((val, ctx) => {
    try {
      create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : `Invalid ${field}`,
      });
    }
  });
}

export const emailField = delegateTo((v) => Email.create(v), 'email');
export const newPasswordField = delegateTo((v) => Password.create(v), 'newPassword');
export const resetCodeField = delegateTo((v) => ResetCode.create(v), 'code');
