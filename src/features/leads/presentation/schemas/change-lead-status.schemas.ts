import { z } from 'zod';

import { leadStatusSchema, optionalTextSchema } from './lead-fields.schemas';

export const changeLeadStatusBodySchema = z
  .object({
    status: leadStatusSchema,
    notes: optionalTextSchema,
    markVehicleSold: z.boolean().optional().default(false),
  })
  .superRefine((body, ctx) => {
    if (body.markVehicleSold && body.status !== 'sold') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['markVehicleSold'],
        message: 'markVehicleSold can only be used when status is sold',
      });
    }
  });
