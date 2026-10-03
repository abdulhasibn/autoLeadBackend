import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { MakeId } from './make-id';
import type { ModelId } from './model-id';

export interface MakeReadModel {
  readonly id: string;
  readonly name: string;
}

export interface ModelReadModel {
  readonly id: string;
  readonly makeId: string;
  readonly name: string;
}

export interface VariantReadModel {
  readonly id: string;
  readonly modelId: string;
  readonly name: string;
  readonly fuelType: string | null;
  readonly transmission: string | null;
  readonly exShowroomPrice: number | null;
}

export interface ICatalogQueries {
  listMakes(page: Pagination): Promise<Page<MakeReadModel>>;
  listModels(makeId: MakeId, page: Pagination): Promise<Page<ModelReadModel>>;
  listVariants(modelId: ModelId, page: Pagination): Promise<Page<VariantReadModel>>;
}
