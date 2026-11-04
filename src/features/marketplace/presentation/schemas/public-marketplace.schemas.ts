import { z } from 'zod';

import { BodyType } from '../../../../domain/shared/body-type.value-object';
import { FuelType } from '../../../../domain/shared/fuel-type.value-object';
import { Transmission } from '../../../../domain/shared/transmission.value-object';
import { optionalCsvSchema, refineRange } from '../../../../presentation/validation/search.schemas';
import { visitorTouchSchema } from '../../../../presentation/validation/visitor-touch.schemas';

export const MAX_PUBLIC_PAGE_SIZE = 48;

const optionalAmount = z.coerce.number({ error: 'must be a number' }).int().min(0).optional();

export const listPublicVehiclesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_PUBLIC_PAGE_SIZE).default(24),
    offset: z.coerce.number().int().min(0).default(0),
    makeId: z.string().uuid('makeId must be a UUID').optional(),
    modelId: z.string().uuid('modelId must be a UUID').optional(),
    bodyType: optionalCsvSchema('bodyType', (raw) => BodyType.create(raw).value),
    fuelType: optionalCsvSchema('fuelType', (raw) => FuelType.create(raw).value),
    transmission: optionalCsvSchema('transmission', (raw) => Transmission.create(raw).value),
    priceMin: optionalAmount,
    priceMax: optionalAmount,
    yearMin: z.coerce.number().int().min(1950).max(2100).optional(),
    kmMax: optionalAmount,
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'km_asc']).default('newest'),
  })
  .superRefine(refineRange('priceMin', 'priceMax'));

export const publicVehicleIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

export const submitTestDriveBodySchema = z.object({
  vehicleId: z.string().uuid('vehicleId must be a UUID'),
  fullName: z
    .string()
    .trim()
    .min(2, 'Enter your name')
    .max(80, 'Name is too long')
    .regex(/^[\p{L}\p{M}.' -]+$/u, 'Name can only contain letters'),
  phone: z.string().trim().min(10).max(20),
  // Honeypot: hidden from people, filled by bots. Any value means a bot.
  fax: z.string().max(200).optional(),
  // Where the visitor came from (website analytics). Optional: older clients omit it.
  attribution: z
    .object({
      visitorId: z.string().uuid(),
      sessionId: z.string().uuid(),
      firstTouch: visitorTouchSchema,
      lastTouch: visitorTouchSchema,
    })
    .optional(),
});
