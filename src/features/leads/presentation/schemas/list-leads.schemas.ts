import { z } from 'zod';

import {
  optionalBooleanQuerySchema,
  optionalCsvSchema,
  optionalInstantQuerySchema,
  optionalNumberQuerySchema,
  optionalSearchSchema,
  refineRange,
} from '../../../../presentation/validation/search.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import { Budget } from '../../domain/budget.value-object';
import { LeadSource } from '../../domain/lead-source.value-object';
import { optionalLeadStatusSchema } from './lead-fields.schemas';

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

const optionalBudgetQuerySchema = optionalNumberQuerySchema((val) => Budget.create(val));

export const listLeadsQuerySchema = paginationQuerySchema
  .extend({
    status: optionalLeadStatusSchema,
    vehicleId: z.string().uuid('vehicleId must be a UUID').optional(),
    assignedTo: z.string().uuid('assignedTo must be a UUID').optional(),
    preferredMakeId: z.string().uuid('preferredMakeId must be a UUID').optional(),
    preferredModelId: z.string().uuid('preferredModelId must be a UUID').optional(),
    preferredVariantId: z.string().uuid('preferredVariantId must be a UUID').optional(),
    search: optionalSearchSchema,
    budgetMin: optionalBudgetQuerySchema,
    budgetMax: optionalBudgetQuerySchema,
    source: optionalCsvSchema('source', (raw) => LeadSource.create(raw).value),
    hasVehicle: optionalBooleanQuerySchema,
    purchaseTimeline: z.string().trim().min(1).max(100).optional(),
    financeRequired: optionalBooleanQuerySchema,
    createdFrom: optionalInstantQuerySchema,
    createdTo: optionalInstantQuerySchema,
  })
  .superRefine(refineRange('budgetMin', 'budgetMax'))
  .superRefine(refineRange('createdFrom', 'createdTo'));
