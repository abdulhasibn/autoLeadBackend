import type { UserId } from '../../../domain/shared/user-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import type { StaffRoleName } from './staff-role.value-object';

/**
 * Read-model shaped for the staff admin screens. Not an entity.
 */
export interface StaffMemberReadModel {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly showroomId: string | null;
  readonly roles: readonly string[];
  readonly createdAt: string;
}

export interface StaffListCriteria {
  readonly role?: StaffRoleName;
}

/**
 * Query port for staff list/get. Returns read models, never reconstitutes StaffUser.
 */
export interface IStaffQueries {
  listStaff(criteria: StaffListCriteria, page: Pagination): Promise<Page<StaffMemberReadModel>>;
  getStaff(id: UserId): Promise<StaffMemberReadModel | null>;
}
