import { z } from 'zod';

import { Phone } from '../../domain/phone.value-object';

/**
 * Zod schema for POST /auth/otp/send.
 * Delegates phone validation to the Phone VO via superRefine — the business
 * rule is never duplicated here (architecture.md §14).
 */
export const sendOtpBodySchema = z.object({
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
});

export type SendOtpBody = z.infer<typeof sendOtpBodySchema>;
