import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toUserId } from '../../../../domain/shared/user-id';
import type { Clock } from '../../../../shared/clock/clock';
import { LastAdminProtectedError } from '../errors/last-admin-protected.error';
import type { AdminStaffPolicy } from '../policies/admin-staff.policy';
import type { IAuthUserProvisioner } from '../ports/auth-user-provisioner.port';
import { StaffRole } from '../../domain/staff-role.value-object';
import type { IUserRepository } from '../../domain/user.repository';

export class DeactivateStaffUseCase {
  constructor(
    private readonly policy: AdminStaffPolicy,
    private readonly repo: IUserRepository,
    private readonly provisioner: IAuthUserProvisioner,
    private readonly clock: Clock,
  ) {}

  async execute(userIdRaw: string, ctx: AuthenticatedContext): Promise<void> {
    this.policy.requireAdmin(ctx);

    const userId = toUserId(userIdRaw);
    if (userId === ctx.userId) {
      throw new LastAdminProtectedError('Cannot deactivate your own account');
    }

    const staff = await this.repo.findById(userId);
    if (staff === null) {
      throw new NotFoundError(`Staff user not found for id ${userIdRaw}`);
    }

    if (staff.hasAdminRole) {
      const adminCount = await this.repo.countLiveWithRole(StaffRole.admin());
      if (adminCount <= 1) {
        throw new LastAdminProtectedError();
      }
    }

    staff.deactivate(this.clock.now());
    await this.repo.save(staff, ctx.userId);
    await this.provisioner.disable(userId);
  }
}
