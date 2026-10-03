import type { UserId } from '../../../domain/shared/user-id';
import type { StaffRole } from './staff-role.value-object';
import type { StaffUser } from './staff-user.entity';

/**
 * Command-side persistence for the StaffUser aggregate.
 * Invariant-preserving lookups and writes only — listing lives on IStaffQueries.
 */
export interface IUserRepository {
  findById(id: UserId): Promise<StaffUser | null>;
  save(user: StaffUser, grantedBy: UserId): Promise<void>;
  countLiveWithRole(role: StaffRole): Promise<number>;
}
