import { z } from 'zod';

import {
  leadSourceSchema,
  optionalBooleanSchema,
  optionalBudgetSchema,
  optionalCatalogIdSchema,
  optionalEmailSchema,
  optionalTextSchema,
  optionalVehicleIdSchema,
  phoneSchema,
} from './lead-fields.schemas';

export const createLeadBodySchema = z.object({
  showroomId: z
    .string()
    .uuid('showroomId must be a UUID')
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  fullName: z.string({ error: 'fullName is required' }).trim().min(1, 'fullName cannot be empty'),
  phone: phoneSchema,
  email: optionalEmailSchema,
  source: leadSourceSchema,
  vehicleId: optionalVehicleIdSchema,
  budget: optionalBudgetSchema,
  preferredVehicle: optionalTextSchema,
  preferredMakeId: optionalCatalogIdSchema('preferredMakeId'),
  preferredModelId: optionalCatalogIdSchema('preferredModelId'),
  preferredVariantId: optionalCatalogIdSchema('preferredVariantId'),
  purchaseTimeline: optionalTextSchema,
  financeRequired: optionalBooleanSchema,
  currentVehicle: optionalTextSchema,
  tradeInRequired: optionalBooleanSchema,
  notes: optionalTextSchema,
});
