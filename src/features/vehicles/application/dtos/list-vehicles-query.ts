import type { Pagination } from '../../../../shared/pagination/pagination';

export interface ListVehiclesQuery {
  readonly status?: string;
  readonly ownerId?: string;
  readonly showroomId?: string;
  readonly registration?: string;
  readonly page: Pagination;
}
