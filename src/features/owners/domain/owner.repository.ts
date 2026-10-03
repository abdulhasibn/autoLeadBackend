import type { UserId } from '../../../domain/shared/user-id';
import type { Owner } from './owner.entity';
import type { OwnerId } from '../../../domain/shared/owner-id';

/**
 * Command-side persistence for the Owner aggregate.
 * Listing lives on IOwnerQueries.
 */
export interface IOwnerRepository {
  findById(id: OwnerId): Promise<Owner | null>;
  isLive(id: OwnerId): Promise<boolean>;
  save(owner: Owner, createdBy: UserId): Promise<void>;
}
