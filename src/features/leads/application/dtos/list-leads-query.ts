import type { Pagination } from '../../../../shared/pagination/pagination';

export interface ListLeadsQuery {
  readonly status?: string;
  readonly vehicleId?: string;
  /** Admin-only filter; a salesperson always sees their own leads. */
  readonly assignedTo?: string;
  readonly page: Pagination;
}
