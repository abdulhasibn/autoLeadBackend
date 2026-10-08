import type { Pagination } from '../../../../shared/pagination/pagination';

export interface ListLeadsQuery {
  readonly status?: string;
  readonly vehicleId?: string;
  /** Admin-only filter; a salesperson always sees their own leads. */
  readonly assignedTo?: string;
  readonly preferredMakeId?: string;
  readonly preferredModelId?: string;
  readonly preferredVariantId?: string;
  readonly search?: string;
  readonly budgetMin?: number;
  readonly budgetMax?: number;
  readonly sources?: readonly string[];
  /** true: a vehicle is linked; false: none is. */
  readonly hasVehicle?: boolean;
  readonly purchaseTimeline?: string;
  readonly financeRequired?: boolean;
  /** Inclusive lower bound on created_at (ISO timestamp). */
  readonly createdFrom?: string;
  /** Exclusive upper bound on created_at (ISO timestamp). */
  readonly createdTo?: string;
  readonly page: Pagination;
}
