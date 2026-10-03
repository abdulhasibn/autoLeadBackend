import { z } from 'zod';

import { Email } from '../../../../domain/shared/email.value-object';
import { Password } from '../../../../domain/shared/password.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import { StaffRole } from '../../domain/staff-role.value-object';

export const phoneSchema = z.string({ error: 'phone is required' }).superRefine((val, ctx) => {
  try {
    Phone.create(val);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid phone number',
    });
  }
});

export const emailSchema = z.string({ error: 'email is required' }).superRefine((val, ctx) => {
  try {
    Email.create(val);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid email',
    });
  }
});

export const passwordSchema = z
  .string({ error: 'password is required' })
  .superRefine((val, ctx) => {
    try {
      Password.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid password',
      });
    }
  });

export const staffRoleSchema = z.string({ error: 'role is required' }).superRefine((val, ctx) => {
  try {
    StaffRole.create(val);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid role',
    });
  }
});

export const optionalShowroomIdSchema = z
  .string()
  .uuid('showroomId must be a UUID')
  .nullable()
  .optional()
  .transform((value) => value ?? null);
