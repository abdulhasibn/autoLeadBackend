import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toUserId } from '../../../../domain/shared/user-id';
import type { StaffMemberDto } from '../dtos/staff-member.dto';
import { toStaffMemberDto } from '../dtos/staff-member.dto';
import type { ReplaceStaffRolesCommand } from '../dtos/replace-staff-roles-command';
import { LastAdminProtectedError } from '../errors/last-admin-protected.error';
import type { AdminStaffPolicy } from '../policies/admin-staff.policy';
import { StaffRole } from '../../domain/staff-role.value-object';
import type { IUserRepository } from '../../domain/user.repository';

export class ReplaceStaffRolesUseCase {
  constructor(
    private readonly policy: AdminStaffPolicy,
    private readonly repo: IUserRepository,
  ) {}

  async execute(
    command: ReplaceStaffRolesCommand,
    ctx: AuthenticatedContext,
  ): Promise<StaffMemberDto> {
    this.policy.requireAdmin(ctx);

    const userId = toUserId(command.userId);
    const staff = await this.repo.findById(userId);
    if (staff === null) {
      throw new NotFoundError(`Staff user not found for id ${command.userId}`);
    }

    const nextRoles = command.roles.map((role) => StaffRole.create(role));
    const nextHasAdmin = nextRoles.some((role) => role.isAdmin);

    if (staff.hasAdminRole && !nextHasAdmin) {
      const adminCount = await this.repo.countLiveWithRole(StaffRole.admin());
      if (adminCount <= 1) {
        throw new LastAdminProtectedError();
      }
    }

    staff.replaceRoles(nextRoles);
    await this.repo.save(staff, ctx.userId);

    return toStaffMemberDto(staff);
  }
}
