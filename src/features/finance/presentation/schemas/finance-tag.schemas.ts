import { z } from 'zod';

import { optionalBooleanQuerySchema } from '../../../../presentation/validation/search.schemas';
import { tagColorSchema, tagNameSchema, uuidSchema } from './finance-fields.schemas';

export const financeTagIdParamSchema = z.object({ id: uuidSchema('id') });

export const listFinanceTagsQuerySchema = z.object({
  includeArchived: optionalBooleanQuerySchema,
});

export const createFinanceTagBodySchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema.nullable().optional(),
});

export const updateFinanceTagBodySchema = z
  .object({
    name: tagNameSchema.optional(),
    color: tagColorSchema.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Send at least one of name, color, archived',
  });
