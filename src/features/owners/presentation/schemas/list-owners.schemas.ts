import { z } from 'zod';

import { Phone } from '../../../../domain/shared/phone.value-object';
import { optionalSearchSchema } from '../../../../presentation/validation/search.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';

export const listOwnersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  city: z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    }),
  phone: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      if (val === undefined || val.trim().length === 0) {
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
    .transform((value) => {
      if (value === undefined || value.trim().length === 0) {
        return undefined;
      }
      return Phone.create(value).value;
    }),
  search: optionalSearchSchema,
});

export type ListOwnersQueryParams = z.infer<typeof listOwnersQuerySchema>;
