import { z } from 'zod';

import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { AcquisitionType } from '../../domain/acquisition-type.value-object';
import { FuelType } from '../../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../../domain/previous-owners.value-object';
import { RegistrationNumber } from '../../domain/registration-number.value-object';
import { Transmission } from '../../../../domain/shared/transmission.value-object';
import { parseLoanStatus, parseRcStatus, parseServiceHistory } from '../../domain/vehicle-details';
import { DocumentContentType } from '../../domain/document-content-type.value-object';
import { DocumentFileName } from '../../domain/document-file-name.value-object';
import { DocumentType } from '../../domain/document-type.value-object';
import { MediaCategory } from '../../domain/media-category.value-object';
import { MediaContentType } from '../../domain/media-content-type.value-object';
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

export const vehicleStatusSchema = z
  .string({ error: 'status is required' })
  .superRefine(refineVo((val) => VehicleStatus.create(val)))
  .transform((val) => VehicleStatus.create(val).value);

export const mediaCategorySchema = z
  .string({ error: 'category is required' })
  .superRefine(refineVo((val) => MediaCategory.create(val)))
  .transform((val) => MediaCategory.create(val).value);

export const mediaContentTypeSchema = z
  .string({ error: 'contentType is required' })
  .superRefine(refineVo((val) => MediaContentType.create(val)))
  .transform((val) => MediaContentType.create(val).value);

export const documentTypeSchema = z
  .string({ error: 'docType is required' })
  .superRefine(refineVo((val) => DocumentType.create(val)))
  .transform((val) => DocumentType.create(val).value);

/** Optional display name; blank counts as not sent. */
export const optionalDocumentFileNameSchema = z
  .string()
  .nullable()
  .optional()
  .transform((val) => (val === null || val === undefined || val.trim().length === 0 ? null : val))
  .superRefine((val, ctx) => {
    if (val !== null) {
      refineVo((name) => DocumentFileName.create(name))(val, ctx);
    }
  })
  .transform((val) => (val === null ? null : DocumentFileName.create(val).value));

export const documentContentTypeSchema = z
  .string({ error: 'contentType is required' })
  .superRefine(refineVo((val) => DocumentContentType.create(val)))
  .transform((val) => DocumentContentType.create(val).value);

export const sortOrderSchema = z
  .number({ error: 'sortOrder is required' })
  .int()
  .min(0)
  .max(32767)
  .default(0);

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
