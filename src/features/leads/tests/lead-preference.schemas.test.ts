import { describe, expect, it } from 'vitest';

import { createLeadBodySchema } from '../presentation/schemas/create-lead.schemas';
import { setLeadPreferenceBodySchema } from '../presentation/schemas/set-lead-preference.schemas';

describe('lead preference schemas', () => {
  it('defaults every omitted preference field to empty', () => {
    expect(setLeadPreferenceBodySchema.parse({})).toEqual({
      preferredMakeId: null,
      preferredModelId: null,
      preferredVariantId: null,
      preferredColours: [],
      preferredFuelTypes: [],
      preferredTransmissions: [],
      preferredBodyTypes: [],
      preferredYearMin: null,
      preferredYearMax: null,
      preferredKmMax: null,
      preferredMaxOwners: null,
    });
  });

  it('rejects what the LeadPreference value object rejects', () => {
    expect(setLeadPreferenceBodySchema.safeParse({ preferredFuelTypes: ['steam'] }).success).toBe(
      false,
    );
    expect(
      setLeadPreferenceBodySchema.safeParse({ preferredYearMin: 2022, preferredYearMax: 2018 })
        .success,
    ).toBe(false);
    expect(setLeadPreferenceBodySchema.safeParse({ preferredKmMax: -5 }).success).toBe(false);
  });

  it('accepts preference fields on lead creation', () => {
    const parsed = createLeadBodySchema.parse({
      fullName: 'Rahul Sharma',
      phone: '+919811122233',
      source: 'walkin',
      budget: 650000,
      preferredBodyTypes: ['suv'],
      preferredYearMin: 2019,
    });
    expect(parsed.preferredBodyTypes).toEqual(['suv']);
    expect(parsed.preferredYearMin).toBe(2019);
    expect(parsed.preferredColours).toEqual([]);
  });
});
