import type { ICatalogLineageLookup } from '../../domain/catalog-lineage.port';
import { LeadPreference } from '../../domain/lead-preference.value-object';
import type { LeadPreferenceFields } from '../dtos/lead-preference-fields';
import { resolvePreferredCatalog } from './resolve-preferred-catalog';

/** Resolves the catalog chain, then builds the whole preference. */
export async function buildLeadPreference(
  catalog: ICatalogLineageLookup,
  fields: LeadPreferenceFields,
): Promise<LeadPreference> {
  const preferredCatalog = await resolvePreferredCatalog(catalog, {
    makeId: fields.preferredMakeId,
    modelId: fields.preferredModelId,
    variantId: fields.preferredVariantId,
  });
  return LeadPreference.create({
    catalog: preferredCatalog,
    colours: fields.preferredColours,
    fuelTypes: fields.preferredFuelTypes,
    transmissions: fields.preferredTransmissions,
    bodyTypes: fields.preferredBodyTypes,
    yearMin: fields.preferredYearMin,
    yearMax: fields.preferredYearMax,
    kmMax: fields.preferredKmMax,
    maxOwners: fields.preferredMaxOwners,
  });
}
