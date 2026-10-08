import type { Pagination } from '../../../../shared/pagination/pagination';

export interface ListVehiclesQuery {
  readonly status?: string;
  readonly ownerId?: string;
  readonly showroomId?: string;
  readonly registration?: string;
  readonly search?: string;
  readonly makeId?: string;
  readonly modelId?: string;
  readonly variantId?: string;
  readonly yearMin?: number;
  readonly yearMax?: number;
  readonly kmMin?: number;
  readonly kmMax?: number;
  readonly fuelTypes?: readonly string[];
  readonly transmissions?: readonly string[];
  readonly page: Pagination;
}
