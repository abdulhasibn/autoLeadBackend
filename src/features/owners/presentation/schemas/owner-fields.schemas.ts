import { z } from 'zod';

import { Email } from '../../../../domain/shared/email.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import { parsePreferredContactMethod } from '../../domain/owner.entity';

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

export const optionalPhoneSchema = z
  .string()
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      Phone.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid phone number',
      });
    }
  })
  .transform((val) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return null;
    }
    return Phone.create(val).value;
  });

export const optionalEmailSchema = z
  .string()
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      Email.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid email',
      });
    }
  })
  .transform((val) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return null;
    }
    return Email.create(val).value;
  });

export const optionalTextSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) {
      return null;
    }
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export const preferredContactMethodSchema = z
  .string()
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    try {
      parsePreferredContactMethod(val ?? null);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid preferred contact method',
      });
    }
  })
  .transform((val) => parsePreferredContactMethod(val ?? null));
