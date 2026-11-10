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

/** 0 < % ≤ 100, at most two decimals; sent on as basis points. */
const commissionPercentSchema = z
  .number({ error: 'commissionPercent must be a number' })
  .gt(0, 'commissionPercent must be greater than 0')
  .max(100, 'commissionPercent must be at most 100')
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: 'commissionPercent can have at most two decimals',
  })
  .transform((v) => Math.round(v * 100));

/** Purchase cars send `purchaseRate`; commission cars send `commissionPercent`. */
export const setVehicleDealBodySchema = z.object({
  purchaseRate: amountSchema.nullable().default(null),
  commissionPercent: commissionPercentSchema.nullable().default(null),
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
