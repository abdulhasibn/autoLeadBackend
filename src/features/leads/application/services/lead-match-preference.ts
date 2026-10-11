import type { MatchPreference } from '../../domain/lead-vehicle-match';
import type { LeadReadModel } from '../../domain/lead.queries';

/** What a lead asked for, in the terms the match score reads. */
export function toMatchPreference(lead: LeadReadModel): MatchPreference {
  return {
    makeId: lead.preferredMakeId,
    modelId: lead.preferredModelId,
    variantId: lead.preferredVariantId,
    budget: lead.budget,
    colours: lead.preferredColours,
    fuelTypes: lead.preferredFuelTypes,
    transmissions: lead.preferredTransmissions,
    bodyTypes: lead.preferredBodyTypes,
    yearMin: lead.preferredYearMin,
    yearMax: lead.preferredYearMax,
    kmMax: lead.preferredKmMax,
    maxOwners: lead.preferredMaxOwners,
  };
}

/** False when the lead filled in nothing a vehicle could be scored on. */
export function hasMatchCriteria(preference: MatchPreference): boolean {
  return (
    preference.makeId !== null ||
    preference.budget !== null ||
    preference.yearMin !== null ||
    preference.yearMax !== null ||
    preference.kmMax !== null ||
    preference.maxOwners !== null ||
    preference.colours.length > 0 ||
    preference.fuelTypes.length > 0 ||
    preference.transmissions.length > 0 ||
    preference.bodyTypes.length > 0
  );
}
