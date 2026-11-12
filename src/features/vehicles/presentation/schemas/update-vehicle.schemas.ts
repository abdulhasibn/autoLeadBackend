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

export const updateVehicleBodySchema = z.object({
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
  accidentHistory: z.boolean(),
  loanStatus: optionalLoanStatusSchema,
  location: optionalTextSchema,
  description: optionalTextSchema,
  /** Optional: purchase vs commission, correctable until the car is sold. */
  acquisitionType: acquisitionTypeSchema.optional(),
});

export type UpdateVehicleBody = z.infer<typeof updateVehicleBodySchema>;
