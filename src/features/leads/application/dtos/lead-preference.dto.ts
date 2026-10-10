import type { LeadPreference } from '../../domain/lead-preference.value-object';

export interface LeadPreferenceDto {
  readonly preferredMakeId: string | null;
  readonly preferredModelId: string | null;
  readonly preferredVariantId: string | null;
  readonly preferredColours: readonly string[];
  readonly preferredFuelTypes: readonly string[];
  readonly preferredTransmissions: readonly string[];
  readonly preferredBodyTypes: readonly string[];
  readonly preferredYearMin: number | null;
  readonly preferredYearMax: number | null;
  readonly preferredKmMax: number | null;
  readonly preferredMaxOwners: number | null;
}

export function toLeadPreferenceDto(preference: LeadPreference): LeadPreferenceDto {
  return {
    preferredMakeId: preference.catalog.makeId,
    preferredModelId: preference.catalog.modelId,
    preferredVariantId: preference.catalog.variantId,
    preferredColours: preference.colours,
    preferredFuelTypes: preference.fuelTypes,
    preferredTransmissions: preference.transmissions,
    preferredBodyTypes: preference.bodyTypes,
    preferredYearMin: preference.yearMin,
    preferredYearMax: preference.yearMax,
    preferredKmMax: preference.kmMax,
    preferredMaxOwners: preference.maxOwners,
  };
}
