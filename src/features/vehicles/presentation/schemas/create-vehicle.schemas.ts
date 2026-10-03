import { z } from 'zod';

import {
  acquisitionTypeSchema,
  colourSchema,
  fuelTypeSchema,
  kmDrivenSchema,
  optionalInsuranceDateSchema,
  optionalLoanStatusSchema,
  optionalRcStatusSchema,
  optionalServiceHistorySchema,
  optionalTextSchema,
  previousOwnersSchema,
  registrationNumberSchema,
  transmissionSchema,
  vehicleYearSchema,
} from './vehicle-fields.schemas';

export const createVehicleBodySchema = z.object({
  showroomId: z.string({ error: 'showroomId is required' }).uuid('showroomId must be a UUID'),
  ownerId: z.string({ error: 'ownerId is required' }).uuid('ownerId must be a UUID'),
  variantId: z.string({ error: 'variantId is required' }).uuid('variantId must be a UUID'),
  year: vehicleYearSchema,
  registrationNumber: registrationNumberSchema,
  fuelType: fuelTypeSchema,
  transmission: transmissionSchema,
  kmDriven: kmDrivenSchema,
  numPreviousOwners: previousOwnersSchema,
  colour: colourSchema,
  insuranceValidUntil: optionalInsuranceDateSchema,
  rcStatus: optionalRcStatusSchema,
  serviceHistory: optionalServiceHistorySchema,
  accidentHistory: z.boolean().optional().default(false),
  loanStatus: optionalLoanStatusSchema,
  location: optionalTextSchema,
  description: optionalTextSchema,
  acquisitionType: acquisitionTypeSchema,
});

export type CreateVehicleBody = z.infer<typeof createVehicleBodySchema>;
