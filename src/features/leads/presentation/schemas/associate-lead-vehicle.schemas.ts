import { z } from 'zod';

export const associateLeadVehicleBodySchema = z.object({
  vehicleId: z.string({ error: 'vehicleId is required' }).uuid('vehicleId must be a UUID'),
});
