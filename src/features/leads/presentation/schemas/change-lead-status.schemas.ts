import { z } from 'zod';

import { leadStatusSchema, optionalTextSchema } from './lead-fields.schemas';

export const changeLeadStatusBodySchema = z.object({
  status: leadStatusSchema,
  notes: optionalTextSchema,
});
