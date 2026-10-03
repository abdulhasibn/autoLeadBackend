import type { Pagination } from '../../../../shared/pagination/pagination';
import type { StaffRoleName } from '../../domain/staff-role.value-object';

export interface ListStaffQuery {
  readonly role?: StaffRoleName;
  readonly page: Pagination;
}
