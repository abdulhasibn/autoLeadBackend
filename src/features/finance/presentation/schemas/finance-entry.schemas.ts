import { z } from 'zod';

import {
  optionalBooleanQuerySchema,
  optionalCsvSchema,
  optionalSearchSchema,
  refineRange,
} from '../../../../presentation/validation/search.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import { ENTRY_SORTS } from '../../application/dtos/list-finance-entries-query';
import { ENTRY_KINDS } from '../../domain/entry-kind.value-object';
import { ENTRY_PURPOSES, EntryPurpose } from '../../domain/entry-purpose.value-object';
import { MAX_TAGS_PER_ENTRY } from '../../domain/finance-entry.entity';
import {
  amountSchema,
  calendarDateSchema,
  optionalAmountQuerySchema,
  optionalTextSchema,
  uuidSchema,
} from './finance-fields.schemas';

export const financeEntryIdParamSchema = z.object({ id: uuidSchema('id') });

const tagIdsSchema = z
  .array(uuidSchema('tagIds[]'))
  .max(MAX_TAGS_PER_ENTRY, `At most ${MAX_TAGS_PER_ENTRY} tags`);

const purposeSchema = z.enum(ENTRY_PURPOSES, {
  error: `purpose must be one of: ${ENTRY_PURPOSES.join(', ')}`,
});

export const createFinanceEntryBodySchema = z.object({
  kind: z.enum(ENTRY_KINDS, { error: `kind must be one of: ${ENTRY_KINDS.join(', ')}` }),
  amount: amountSchema,
  entryDate: calendarDateSchema,
  tagIds: tagIdsSchema.default([]),
  vehicleId: uuidSchema('vehicleId').nullable().default(null),
  purpose: purposeSchema.nullable().default(null),
  party: optionalTextSchema.transform((v) => v ?? null),
  note: optionalTextSchema.transform((v) => v ?? null),
  showroomId: uuidSchema('showroomId').nullable().default(null),
});

export const updateFinanceEntryBodySchema = z
  .object({
    amount: amountSchema.optional(),
    entryDate: calendarDateSchema.optional(),
    tagIds: tagIdsSchema.optional(),
    vehicleId: uuidSchema('vehicleId').nullable().optional(),
    purpose: purposeSchema.optional(),
    party: optionalTextSchema,
    note: optionalTextSchema,
    showroomId: uuidSchema('showroomId').optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Send at least one field to change',
  });

export const listFinanceEntriesQuerySchema = z
  .object({
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    kind: z.enum(ENTRY_KINDS).optional(),
    vehicleId: uuidSchema('vehicleId').optional(),
    unlinked: optionalBooleanQuerySchema,
    showroomId: uuidSchema('showroomId').optional(),
    tagId: optionalCsvSchema('tagId', (raw) => uuidSchema('tagId').parse(raw)),
    purpose: optionalCsvSchema('purpose', (raw) => EntryPurpose.parse(raw)),
    minAmount: optionalAmountQuerySchema,
    maxAmount: optionalAmountQuerySchema,
    search: optionalSearchSchema,
    sort: z.enum(ENTRY_SORTS).default('date'),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine(refineRange('minAmount', 'maxAmount'))
  .superRefine(refineRange('from', 'to'));
