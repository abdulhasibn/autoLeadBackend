import { z } from 'zod';

import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { Money } from '../../domain/money.value-object';
import { TagColor } from '../../domain/tag-color.value-object';
import { TagName } from '../../domain/tag-name.value-object';

function delegate<T>(create: (val: T) => unknown, fallback: string) {
  return (val: T, ctx: z.RefinementCtx): void => {
    try {
      create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : fallback,
      });
    }
  };
}

/** Rupees in, paise out. Must be above zero, at most two decimals. */
export const amountSchema = z
  .number({ error: 'amount must be a number of rupees' })
  .positive('amount must be greater than zero')
  .superRefine(delegate((val: number) => Money.fromRupees(val), 'Invalid amount'))
  .transform((val) => Money.fromRupees(val).paise);

/** Optional rupee query bound, as paise. */
export const optionalAmountQuerySchema = z.coerce
  .number({ error: 'must be a number of rupees' })
  .optional()
  .superRefine((val, ctx) => {
    if (val !== undefined) {
      delegate((v: number) => Money.fromRupees(v), 'Invalid amount')(val, ctx);
    }
  })
  .transform((val) => (val === undefined ? undefined : Money.fromRupees(val).paise));

export const calendarDateSchema = z
  .string({ error: 'must be a date (YYYY-MM-DD)' })
  .superRefine(delegate((val: string) => CalendarDate.create(val), 'Invalid date'))
  .transform((val) => CalendarDate.create(val).value);

export const tagNameSchema = z
  .string({ error: 'name is required' })
  .superRefine(delegate((val: string) => TagName.create(val), 'Invalid tag name'))
  .transform((val) => TagName.create(val).value);

export const tagColorSchema = z
  .string()
  .superRefine(delegate((val: string) => TagColor.create(val), 'Invalid colour'))
  .transform((val) => TagColor.create(val).value);

export const uuidSchema = (field: string) => z.string().uuid(`${field} must be a UUID`);

/** Free text where blank means none. Length limits live on the entity. */
export const optionalTextSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) =>
    val === undefined ? undefined : val === null || val.trim() === '' ? null : val,
  );
