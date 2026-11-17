import { z } from 'zod';

import { optionalTextSchema } from './lead-fields.schemas';

export const sellVehicleToLeadBodySchema = z.object({
  vehicleId: z.string({ error: 'vehicleId is required' }).uuid('vehicleId must be a UUID'),
  notes: optionalTextSchema,
});
