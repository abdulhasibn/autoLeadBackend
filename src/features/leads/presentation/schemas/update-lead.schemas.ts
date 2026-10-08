import { z } from 'zod';

import {
  leadSourceSchema,
  optionalBooleanSchema,
  optionalBudgetSchema,
  optionalEmailSchema,
  optionalTextSchema,
  phoneSchema,
} from './lead-fields.schemas';

/** Full replace: omitted optional fields are cleared. */
export const updateLeadBodySchema = z.object({
  fullName: z.string({ error: 'fullName is required' }).trim().min(1, 'fullName cannot be empty'),
  phone: phoneSchema,
  email: optionalEmailSchema,
  source: leadSourceSchema,
  budget: optionalBudgetSchema,
  purchaseTimeline: optionalTextSchema,
  financeRequired: optionalBooleanSchema,
  currentVehicle: optionalTextSchema,
  tradeInRequired: optionalBooleanSchema,
  notes: optionalTextSchema,
});
