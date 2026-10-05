import { z } from 'zod';

import { optionalTextSchema, vehicleStatusSchema } from './vehicle-fields.schemas';

export const changeVehicleStatusBodySchema = z.object({
  status: vehicleStatusSchema,
  reason: optionalTextSchema,
  confirmUnlinkLeads: z.boolean().optional().default(false),
});
