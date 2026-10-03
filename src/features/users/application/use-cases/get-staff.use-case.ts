import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toUserId } from '../../../../domain/shared/user-id';
import type { StaffMemberDto } from '../dtos/staff-member.dto';
import type { AdminStaffPolicy } from '../policies/admin-staff.policy';
import type { IStaffQueries } from '../../domain/staff.queries';

export class GetStaffUseCase {
  constructor(
    private readonly policy: AdminStaffPolicy,
    private readonly queries: IStaffQueries,
  ) {}

  async execute(userIdRaw: string, ctx: AuthenticatedContext): Promise<StaffMemberDto> {
    this.policy.requireAdmin(ctx);

    const staff = await this.queries.getStaff(toUserId(userIdRaw));
    if (staff === null) {
      throw new NotFoundError(`Staff user not found for id ${userIdRaw}`);
    }

    return staff;
  }
}
