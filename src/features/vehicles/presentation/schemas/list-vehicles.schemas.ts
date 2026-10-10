import { z } from 'zod';

import {
  optionalCsvSchema,
  optionalNumberQuerySchema,
  optionalSearchSchema,
  refineRange,
} from '../../../../presentation/validation/search.schemas';
import { FuelType } from '../../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../../domain/kilometers-driven.value-object';
import { Transmission } from '../../../../domain/shared/transmission.value-object';
import { VehicleYear } from '../../domain/vehicle-year.value-object';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';
import {
  optionalRegistrationFilterSchema,
  optionalVehicleStatusSchema,
} from './vehicle-fields.schemas';

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export const listVehiclesQuerySchema = paginationQuerySchema
  .extend({
    status: optionalVehicleStatusSchema,
    ownerId: z.string().uuid('ownerId must be a UUID').optional(),
    showroomId: z.string().uuid('showroomId must be a UUID').optional(),
    registration: optionalRegistrationFilterSchema,
    search: optionalSearchSchema,
    makeId: z.string().uuid('makeId must be a UUID').optional(),
    modelId: z.string().uuid('modelId must be a UUID').optional(),
    variantId: z.string().uuid('variantId must be a UUID').optional(),
    yearMin: optionalNumberQuerySchema((val) => VehicleYear.create(val)),
    yearMax: optionalNumberQuerySchema((val) => VehicleYear.create(val)),
    kmMin: optionalNumberQuerySchema((val) => KilometersDriven.create(val)),
    kmMax: optionalNumberQuerySchema((val) => KilometersDriven.create(val)),
    fuelType: optionalCsvSchema('fuelType', (raw) => FuelType.create(raw).value),
    transmission: optionalCsvSchema('transmission', (raw) => Transmission.create(raw).value),
  })
  .superRefine(refineRange('yearMin', 'yearMax'))
  .superRefine(refineRange('kmMin', 'kmMax'));

export type ListVehiclesQueryParams = z.infer<typeof listVehiclesQuerySchema>;
