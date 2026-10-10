/** A buyer's preference as sent by a client; every part is optional. */
export interface LeadPreferenceFields {
  /** Catalog interest; only the narrowest id is needed, parents are filled in. */
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
