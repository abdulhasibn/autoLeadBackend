import { z } from 'zod';

import { BODY_TYPES, BodyType } from '../../../../domain/shared/body-type.value-object';
import { FUEL_TYPES, FuelType } from '../../../../domain/shared/fuel-type.value-object';
import { TRANSMISSIONS, Transmission } from '../../../../domain/shared/transmission.value-object';
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

const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your name')
  .max(80, 'Name is too long')
  .regex(/^[\p{L}\p{M}.' -]+$/u, 'Name can only contain letters');
const phoneSchema = z.string().trim().min(10).max(20);
// Honeypot: hidden from people, filled by bots. Any value means a bot.
const honeypotSchema = z.string().max(200).optional();
// Where the visitor came from (website analytics). Optional: older clients omit it.
const attributionSchema = z
  .object({
    visitorId: z.string().uuid(),
    sessionId: z.string().uuid(),
    firstTouch: visitorTouchSchema,
    lastTouch: visitorTouchSchema,
  })
  .optional();

export const submitTestDriveBodySchema = z.object({
  vehicleId: z.string().uuid('vehicleId must be a UUID'),
  fullName: fullNameSchema,
  phone: phoneSchema,
  fax: honeypotSchema,
  attribution: attributionSchema,
});

export const MIN_PREFERENCE_BUDGET = 50_000;
export const MAX_PREFERENCE_BUDGET = 10_000_000;
const MAX_PREFERENCE_CHOICES = 5;

const choicesSchema = <T extends string>(values: readonly [T, ...T[]]) =>
  z.array(z.enum(values)).max(MAX_PREFERENCE_CHOICES).optional();
// Free text ends up in staff-facing lead notes: plain name characters only.
const catalogNameSchema = z
  .string()
  .trim()
  .max(60)
  .regex(/^[\p{L}\p{N} .&'-]*$/u, "Use letters, numbers, spaces and . & ' - only")
  .optional();

/** `POST /public/preference-requests`: a contact plus optional "what I want" hints. */
export const submitPreferenceBodySchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  fax: honeypotSchema,
  attribution: attributionSchema,
  // Rupees.
  budgetMax: z
    .number()
    .min(MIN_PREFERENCE_BUDGET, 'budgetMax is too low')
    .max(MAX_PREFERENCE_BUDGET, 'budgetMax is too high')
    .optional(),
  bodyTypes: choicesSchema(BODY_TYPES),
  fuelTypes: choicesSchema(FUEL_TYPES),
  transmissions: choicesSchema(TRANSMISSIONS),
  make: catalogNameSchema,
  model: catalogNameSchema,
  referenceVehicleId: z.string().uuid('referenceVehicleId must be a UUID').optional(),
});
