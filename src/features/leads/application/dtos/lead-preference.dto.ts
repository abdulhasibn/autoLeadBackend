import type { PreferredCatalog } from '../../domain/preferred-catalog.value-object';

export interface LeadPreferenceDto {
  readonly preferredMakeId: string | null;
  readonly preferredModelId: string | null;
  readonly preferredVariantId: string | null;
}

export function toLeadPreferenceDto(preference: PreferredCatalog): LeadPreferenceDto {
  return {
    preferredMakeId: preference.makeId,
    preferredModelId: preference.modelId,
    preferredVariantId: preference.variantId,
  };
}
