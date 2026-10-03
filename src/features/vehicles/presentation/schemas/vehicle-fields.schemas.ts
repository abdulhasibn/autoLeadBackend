import { z } from 'zod';

import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { AcquisitionType } from '../../domain/acquisition-type.value-object';
import { FuelType } from '../../domain/fuel-type.value-object';
import { KilometersDriven } from '../../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../../domain/previous-owners.value-object';
import { RegistrationNumber } from '../../domain/registration-number.value-object';
import { Transmission } from '../../domain/transmission.value-object';
import { parseLoanStatus, parseRcStatus, parseServiceHistory } from '../../domain/vehicle-details';
import { VehicleStatus } from '../../domain/vehicle-status.value-object';
import { VehicleYear } from '../../domain/vehicle-year.value-object';

function refineVo(create: (value: string) => unknown) {
  return (val: string, ctx: z.RefinementCtx) => {
    try {
      create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid value',
      });
    }
  };
}

export const registrationNumberSchema = z
  .string({ error: 'registrationNumber is required' })
  .superRefine(refineVo((val) => RegistrationNumber.create(val)))
  .transform((val) => RegistrationNumber.create(val).value);

export const fuelTypeSchema = z
  .string({ error: 'fuelType is required' })
  .superRefine(refineVo((val) => FuelType.create(val)))
  .transform((val) => FuelType.create(val).value);

export const transmissionSchema = z
  .string({ error: 'transmission is required' })
  .superRefine(refineVo((val) => Transmission.create(val)))
  .transform((val) => Transmission.create(val).value);

export const acquisitionTypeSchema = z
  .string({ error: 'acquisitionType is required' })
  .superRefine(refineVo((val) => AcquisitionType.create(val)))
  .transform((val) => AcquisitionType.create(val).value);

export const vehicleYearSchema = z.number({ error: 'year is required' }).superRefine((val, ctx) => {
  try {
    VehicleYear.create(val);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid year',
    });
  }
});

export const kmDrivenSchema = z
  .number({ error: 'kmDriven is required' })
  .superRefine((val, ctx) => {
    try {
      KilometersDriven.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid kilometers',
      });
    }
  });

export const previousOwnersSchema = z
  .number({ error: 'numPreviousOwners is required' })
  .superRefine((val, ctx) => {
    try {
      PreviousOwners.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid previous owners',
      });
    }
  });

export const colourSchema = z
  .string({ error: 'colour is required' })
  .trim()
  .min(1, 'colour cannot be empty');

export const optionalTextSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => {
    if (val === null || val === undefined) {
      return null;
    }
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export const optionalInsuranceDateSchema = z
  .string()
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      CalendarDate.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid insurance date',
      });
    }
  })
  .transform((val) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return null;
    }
    return CalendarDate.create(val).value;
  });

function optionalEnumSchema(parse: (val: string | null) => string | null) {
  return z
    .string()
    .nullable()
    .optional()
    .superRefine((val, ctx) => {
      try {
        parse(val ?? null);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : 'Invalid value',
        });
      }
    })
    .transform((val) => parse(val ?? null));
}

export const optionalRcStatusSchema = optionalEnumSchema(parseRcStatus);
export const optionalServiceHistorySchema = optionalEnumSchema(parseServiceHistory);
export const optionalLoanStatusSchema = optionalEnumSchema(parseLoanStatus);

export const optionalVehicleStatusSchema = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      VehicleStatus.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid status',
      });
    }
  })
  .transform((val) => {
    if (val === undefined || val.trim().length === 0) {
      return undefined;
    }
    return VehicleStatus.create(val).value;
  });

export const optionalRegistrationFilterSchema = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      RegistrationNumber.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid registration number',
      });
    }
  })
  .transform((val) => {
    if (val === undefined || val.trim().length === 0) {
      return undefined;
    }
    return RegistrationNumber.create(val).value;
  });

export const uuidParamSchema = z.string().uuid('id must be a UUID');
