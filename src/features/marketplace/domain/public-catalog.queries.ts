/** One make in the vehicle catalog, as an anonymous visitor may see it. */
export interface PublicMakeReadModel {
  readonly id: string;
  readonly name: string;
}

export interface PublicModelReadModel {
  readonly id: string;
  readonly name: string;
}

export interface PublicVariantReadModel {
  readonly id: string;
  readonly name: string;
  readonly fuelType: string | null;
  readonly transmission: string | null;
}

/**
 * The reference catalog (makes, models, variants) behind the website's
 * "what are you after?" dropdowns. Reference data only: no prices, no stock.
 * Soft-deleted rows are never returned.
 */
export interface IPublicCatalogQueries {
  listMakes(): Promise<readonly PublicMakeReadModel[]>;
  listModels(makeId: string): Promise<readonly PublicModelReadModel[]>;
  listVariants(modelId: string): Promise<readonly PublicVariantReadModel[]>;
}
