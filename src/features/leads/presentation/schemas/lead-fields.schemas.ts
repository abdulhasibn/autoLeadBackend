import { z } from 'zod';

import { Email } from '../../../../domain/shared/email.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import { Budget } from '../../domain/budget.value-object';
import { FollowUpOutcome } from '../../domain/follow-up-outcome.value-object';
import { FollowUpTaskType } from '../../domain/follow-up-task-type.value-object';
import { LeadPreference } from '../../domain/lead-preference.value-object';
import { LeadSource } from '../../domain/lead-source.value-object';
import { LeadStatus } from '../../domain/lead-status.value-object';
import { PreferredCatalog } from '../../domain/preferred-catalog.value-object';
import { ScheduledAt } from '../../domain/scheduled-at.value-object';

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

export const phoneSchema = z
  .string({ error: 'phone is required' })
  .superRefine(refineVo((val) => Phone.create(val)))
  .transform((val) => Phone.create(val).value);

export const optionalEmailSchema = z
  .string()
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      Email.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid email',
      });
    }
  })
  .transform((val) => {
    if (val === null || val === undefined || val.trim().length === 0) {
      return null;
    }
    return Email.create(val).value;
  });

export const leadSourceSchema = z
  .string({ error: 'source is required' })
  .superRefine(refineVo((val) => LeadSource.create(val)))
  .transform((val) => LeadSource.create(val).value);

export const leadStatusSchema = z
  .string({ error: 'status is required' })
  .superRefine(refineVo((val) => LeadStatus.create(val)))
  .transform((val) => LeadStatus.create(val).value);

export const optionalLeadStatusSchema = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val.trim().length === 0) {
      return;
    }
    try {
      LeadStatus.create(val);
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
    return LeadStatus.create(val).value;
  });

export const followUpTaskTypeSchema = z
  .string({ error: 'taskType is required' })
  .superRefine(refineVo((val) => FollowUpTaskType.create(val)))
  .transform((val) => FollowUpTaskType.create(val).value);

export const followUpOutcomeSchema = z
  .string({ error: 'outcome is required' })
  .superRefine(refineVo((val) => FollowUpOutcome.create(val)))
  .transform((val) => FollowUpOutcome.create(val).value);

export const scheduledAtSchema = z
  .string({ error: 'scheduledAt is required' })
  .superRefine(refineVo((val) => ScheduledAt.create(val)))
  .transform((val) => ScheduledAt.create(val).value.toISOString());

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

export const optionalBudgetSchema = z
  .number()
  .nullable()
  .optional()
  .superRefine((val, ctx) => {
    if (val === null || val === undefined) {
      return;
    }
    try {
      Budget.create(val);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid budget',
      });
    }
  })
  .transform((val) => (val === undefined ? null : val));

export const optionalBooleanSchema = z
  .boolean()
  .nullable()
  .optional()
  .transform((val) => val ?? null);

export function optionalCatalogIdSchema(field: string) {
  return z
    .string()
    .uuid(`${field} must be a UUID`)
    .nullable()
    .optional()
    .transform((val) => val ?? null);
}

export const optionalVehicleIdSchema = z
  .string()
  .uuid('vehicleId must be a UUID')
  .nullable()
  .optional()
  .transform((val) => val ?? null);

const optionalStringListSchema = z
  .array(z.string())
  .max(20, 'At most 20 values are allowed')
  .nullable()
  .optional()
  .transform((val) => val ?? []);

const optionalWholeNumberSchema = z
  .number()
  .nullable()
  .optional()
  .transform((val) => (val === undefined ? null : val));

/** Every preference field; omitted lists are empty and omitted numbers null. */
export const leadPreferenceShape = {
  preferredMakeId: optionalCatalogIdSchema('preferredMakeId'),
  preferredModelId: optionalCatalogIdSchema('preferredModelId'),
  preferredVariantId: optionalCatalogIdSchema('preferredVariantId'),
  preferredColours: optionalStringListSchema,
  preferredFuelTypes: optionalStringListSchema,
  preferredTransmissions: optionalStringListSchema,
  preferredBodyTypes: optionalStringListSchema,
  preferredYearMin: optionalWholeNumberSchema,
  preferredYearMax: optionalWholeNumberSchema,
  preferredKmMax: optionalWholeNumberSchema,
  preferredMaxOwners: optionalWholeNumberSchema,
};

interface ParsedPreferenceFields {
  readonly preferredColours: string[];
  readonly preferredFuelTypes: string[];
  readonly preferredTransmissions: string[];
  readonly preferredBodyTypes: string[];
  readonly preferredYearMin: number | null;
  readonly preferredYearMax: number | null;
  readonly preferredKmMax: number | null;
  readonly preferredMaxOwners: number | null;
}

/** Object-level check: the LeadPreference VO owns the rules (catalog ids are checked later). */
export function refineLeadPreference(val: ParsedPreferenceFields, ctx: z.RefinementCtx): void {
  try {
    LeadPreference.create({
      catalog: PreferredCatalog.none(),
      colours: val.preferredColours,
      fuelTypes: val.preferredFuelTypes,
      transmissions: val.preferredTransmissions,
      bodyTypes: val.preferredBodyTypes,
      yearMin: val.preferredYearMin,
      yearMax: val.preferredYearMax,
      kmMax: val.preferredKmMax,
      maxOwners: val.preferredMaxOwners,
    });
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid preference',
    });
  }
}
