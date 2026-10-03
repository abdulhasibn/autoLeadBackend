import type { StaffMemberReadModel } from '../../domain/staff.queries';
import type { StaffUser } from '../../domain/staff-user.entity';

export type StaffMemberDto = StaffMemberReadModel;

export function toStaffMemberDto(user: StaffUser): StaffMemberDto {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone.value,
    email: user.email,
    showroomId: user.showroomId,
    roles: user.liveRoles.map((role) => role.name),
    createdAt: user.createdAt.toISOString(),
  };
}
