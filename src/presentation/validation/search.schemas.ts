import { z } from 'zod';

import { SearchTerm } from '../../domain/shared/search-term.value-object';

/** Optional `search` query param; blank means no search. */
export const optionalSearchSchema = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      SearchTerm.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid search',
      });
    }
  })
  .transform((val) => {
    if (val === undefined || val.trim().length === 0) {
      return undefined;
    }
    return SearchTerm.create(val).value;
  });

/**
 * Comma-separated multi-value query param (`?fuelType=petrol,diesel`), each
 * value checked by the given Value Object factory. Blank means no filter.
 */
export function optionalCsvSchema<T extends string>(field: string, create: (raw: string) => T) {
  return z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      for (const part of splitCsv(val)) {
        try {
          create(part);
        } catch (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field}: ${err instanceof Error ? err.message : 'invalid value'}`,
          });
        }
      }
    })
    .transform((val) => {
      const parts = splitCsv(val).map(create);
      return parts.length === 0 ? undefined : [...new Set(parts)];
    });
}

/** Optional `true` / `false` query param. */
export const optionalBooleanQuerySchema = z
  .enum(['true', 'false'], { error: 'must be true or false' })
  .optional()
  .transform((val) => (val === undefined ? undefined : val === 'true'));

function splitCsv(val: string | undefined): string[] {
  if (val === undefined) {
    return [];
  }
  return val
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Optional ISO 8601 date or datetime query param, as an ISO timestamp. */
export const optionalInstantQuerySchema = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()], {
    error: 'must be an ISO 8601 date or datetime',
  })
  .optional()
  .transform((val) => (val === undefined ? undefined : new Date(val).toISOString()));

/** Rejects a range whose lower bound is above its upper bound. */
export function refineRange<T>(
  minKey: keyof T & string,
  maxKey: keyof T & string,
): (value: T, ctx: z.RefinementCtx) => void {
  return (value, ctx) => {
    const min = value[minKey];
    const max = value[maxKey];
    if (min !== undefined && max !== undefined && min !== null && max !== null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [minKey],
        message: `${minKey} must not be greater than ${maxKey}`,
      });
    }
  };
}

/** Optional numeric query param, checked by the given Value Object factory. */
export function optionalNumberQuerySchema(create: (raw: number) => unknown) {
  return z.coerce
    .number({ error: 'must be a number' })
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined) {
        return;
      }
      try {
        create(val);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : 'Invalid number',
        });
      }
    });
}
