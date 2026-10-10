import type { Pagination } from '../../../../shared/pagination/pagination';

export interface ListOwnersQuery {
  readonly city?: string;
  readonly phone?: string;
  readonly search?: string;
  readonly page: Pagination;
}
