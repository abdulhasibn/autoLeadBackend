import type { Pagination } from '../../../../shared/pagination/pagination';

export interface ListLeadsQuery {
  readonly status?: string;
  readonly vehicleId?: string;
  readonly page: Pagination;
}
