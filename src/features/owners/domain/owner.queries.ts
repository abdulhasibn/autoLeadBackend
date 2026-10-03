import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { OwnerId } from '../../../domain/shared/owner-id';

/**
 * Read-model shaped for staff owner screens. Not an entity.
 */
export interface OwnerReadModel {
  readonly id: string;
  readonly userId: string | null;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly preferredContactMethod: string | null;
  readonly altPhone: string | null;
  readonly idInfo: string | null;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OwnerListCriteria {
  readonly city?: string;
  readonly phone?: string;
}

/**
 * Query port for owner list/get. Returns read models, never reconstitutes Owner.
 */
export interface IOwnerQueries {
  listOwners(criteria: OwnerListCriteria, page: Pagination): Promise<Page<OwnerReadModel>>;
  getOwner(id: OwnerId): Promise<OwnerReadModel | null>;
}
