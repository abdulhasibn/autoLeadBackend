/**
 * Resolves a catalog entry to its live parents. Null (or false) when the
 * entry, or any parent above it, is missing or soft-deleted.
 */
export interface ICatalogLineage {
  variantLineage(
    variantId: string,
  ): Promise<{ readonly makeId: string; readonly modelId: string } | null>;
  modelLineage(modelId: string): Promise<{ readonly makeId: string } | null>;
  isLiveMake(makeId: string): Promise<boolean>;
}
