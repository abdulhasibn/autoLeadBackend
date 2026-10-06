/**
 * Read-only view of the vehicle catalog (owned by the vehicles feature).
 * Each lookup returns the live parents of a live catalog entry, or null when
 * the entry, or any parent above it, does not exist or is deleted.
 */
export interface ICatalogLineageLookup {
  variantLineage(
    variantId: string,
  ): Promise<{ readonly makeId: string; readonly modelId: string } | null>;
  modelLineage(modelId: string): Promise<{ readonly makeId: string } | null>;
  isLiveMake(makeId: string): Promise<boolean>;
}
