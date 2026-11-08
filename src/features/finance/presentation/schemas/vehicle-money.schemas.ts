import { z } from 'zod';

import { optionalCsvSchema } from '../../../../presentation/validation/search.schemas';
import { MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import {
  amountSchema,
  calendarDateSchema,
  optionalTextSchema,
  uuidSchema,
} from './finance-fields.schemas';

export const vehicleIdParamSchema = z.object({ vehicleId: uuidSchema('vehicleId') });

export const vehicleQuoteParamSchema = z.object({
  vehicleId: uuidSchema('vehicleId'),
  quoteId: uuidSchema('quoteId'),
});

export const setVehicleDealBodySchema = z.object({
  purchaseRate: amountSchema,
  purchasedOn: calendarDateSchema.nullable().default(null),
  ownerExpectedPrice: amountSchema.nullable().default(null),
  minimumSellingPrice: amountSchema.nullable().default(null),
  note: optionalTextSchema.transform((v) => v ?? null),
  /** Omit to keep, null to clear. */
  listedPrice: amountSchema.nullable().optional(),
});

export const recordVehicleSaleBodySchema = z.object({
  finalisedPrice: amountSchema,
  soldOn: calendarDateSchema,
});

export const addVehicleQuoteBodySchema = z.object({
  amount: amountSchema,
  quotedOn: calendarDateSchema,
  leadId: uuidSchema('leadId'),
  quotedTo: optionalTextSchema.transform((v) => v ?? null),
  note: optionalTextSchema.transform((v) => v ?? null),
});

export const vehicleFinanceSummariesQuerySchema = z.object({
  vehicleIds: optionalCsvSchema('vehicleIds', (raw) => uuidSchema('vehicleIds').parse(raw))
    .refine((ids) => ids !== undefined, 'vehicleIds is required')
    .refine((ids) => ids === undefined || ids.length <= MAX_PAGE_SIZE, {
      message: `At most ${MAX_PAGE_SIZE} vehicleIds`,
    }),
});
