import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Email } from '../../../../domain/shared/email.value-object';
import { Password } from '../../../../domain/shared/password.value-object';
import { Phone } from '../../../../domain/shared/phone.value-object';
import type { Clock } from '../../../../shared/clock/clock';
import type { StaffMemberDto } from '../dtos/staff-member.dto';
import { toStaffMemberDto } from '../dtos/staff-member.dto';
import type { CreateStaffCommand } from '../dtos/create-staff-command';
import type { AdminStaffPolicy } from '../policies/admin-staff.policy';
import type { IAuthUserProvisioner } from '../ports/auth-user-provisioner.port';
import { StaffRole } from '../../domain/staff-role.value-object';
import { StaffUser } from '../../domain/staff-user.entity';
import type { IUserRepository } from '../../domain/user.repository';

export class CreateStaffUseCase {
  constructor(
    private readonly policy: AdminStaffPolicy,
    private readonly repo: IUserRepository,
    private readonly provisioner: IAuthUserProvisioner,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateStaffCommand, ctx: AuthenticatedContext): Promise<StaffMemberDto> {
    this.policy.requireAdmin(ctx);

    const phone = Phone.create(command.phone);
    const email = Email.create(command.email);
    const password = Password.create(command.password);
    const roles = command.roles.map((role) => StaffRole.create(role));
    const userId = await this.provisioner.provision({
      email: email.value,
      password: password.value,
    });

    try {
      const staff = StaffUser.create({
        id: userId,
        fullName: command.fullName,
        phone,
        email: email.value,
        showroomId: command.showroomId,
        roles,
        createdAt: this.clock.now(),
      });
      await this.repo.save(staff, ctx.userId);
      return toStaffMemberDto(staff);
    } catch (err) {
      await this.provisioner.delete(userId);
      throw err;
    }
  }
}
