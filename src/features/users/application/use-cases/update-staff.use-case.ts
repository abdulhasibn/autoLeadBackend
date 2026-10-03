import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Email } from '../../../../domain/shared/email.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import { toUserId } from '../../../../domain/shared/user-id';
import type { StaffMemberDto } from '../dtos/staff-member.dto';
import { toStaffMemberDto } from '../dtos/staff-member.dto';
import type { UpdateStaffCommand } from '../dtos/update-staff-command';
import type { AdminStaffPolicy } from '../policies/admin-staff.policy';
import type { IAuthUserProvisioner } from '../ports/auth-user-provisioner.port';
import type { IUserRepository } from '../../domain/user.repository';

export class UpdateStaffUseCase {
  constructor(
    private readonly policy: AdminStaffPolicy,
    private readonly repo: IUserRepository,
    private readonly provisioner: IAuthUserProvisioner,
  ) {}

  async execute(command: UpdateStaffCommand, ctx: AuthenticatedContext): Promise<StaffMemberDto> {
    this.policy.requireAdmin(ctx);

    const userId = toUserId(command.userId);
    const staff = await this.repo.findById(userId);
    if (staff === null) {
      throw new NotFoundError(`Staff user not found for id ${command.userId}`);
    }

    const phone = Phone.create(command.phone);
    const email = Email.create(command.email);
    const emailChanged = staff.email === null || !Email.create(staff.email).equals(email);

    staff.updateProfile({
      fullName: command.fullName,
      phone,
      email: email.value,
      showroomId: command.showroomId,
    });

    await this.repo.save(staff, ctx.userId);

    if (emailChanged) {
      await this.provisioner.updateEmail(userId, email.value);
    }

    return toStaffMemberDto(staff);
  }
}
