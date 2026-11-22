import type {
  IPublicCatalogQueries,
  PublicMakeReadModel,
  PublicModelReadModel,
  PublicVariantReadModel,
} from '../../domain/public-catalog.queries';

/**
 * Walks the catalog one level at a time (make, then its models, then a model's
 * variants), so a dropdown only loads what the visitor opens.
 */
export class GetPublicCatalogUseCase {
  constructor(private readonly queries: IPublicCatalogQueries) {}

  makes(): Promise<readonly PublicMakeReadModel[]> {
    return this.queries.listMakes();
  }

  models(makeId: string): Promise<readonly PublicModelReadModel[]> {
    return this.queries.listModels(makeId);
  }

  async variants(modelId: string): Promise<readonly PublicVariantReadModel[]> {
    const variants = await this.queries.listVariants(modelId);
    // "NA" is the placeholder variant for models without trims: not a choice.
    return variants.filter((variant) => variant.name.toUpperCase() !== 'NA');
  }
}
