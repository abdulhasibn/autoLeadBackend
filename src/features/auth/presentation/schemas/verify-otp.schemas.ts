import { z } from 'zod';

import { Phone } from '../../domain/phone.value-object';

/**
 * Zod schema for POST /auth/otp/verify.
 * Phone validation delegates to the Phone VO via superRefine (architecture.md §14).
 */
export const verifyOtpBodySchema = z.object({
  phone: z
    .string({ error: 'phone is required' })
    .superRefine((val, ctx) => {
      try {
        Phone.create(val);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : 'Invalid phone number',
        });
      }
    }),
  token: z
    .string({ error: 'token is required' })
    .length(6, 'OTP token must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP token must contain only digits'),
});

export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;
