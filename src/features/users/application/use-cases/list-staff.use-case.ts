import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Page } from '../../../../shared/pagination/pagination';
import type { StaffMemberDto } from '../dtos/staff-member.dto';
import type { ListStaffQuery } from '../dtos/list-staff-query';
import type { AdminStaffPolicy } from '../policies/admin-staff.policy';
import type { IStaffQueries } from '../../domain/staff.queries';

export class ListStaffUseCase {
  constructor(
    private readonly policy: AdminStaffPolicy,
    private readonly queries: IStaffQueries,
  ) {}

  async execute(query: ListStaffQuery, ctx: AuthenticatedContext): Promise<Page<StaffMemberDto>> {
    this.policy.requireAdmin(ctx);
    return this.queries.listStaff({ role: query.role }, query.page);
  }
}
