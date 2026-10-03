import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import type { StaffMemberReadModel } from '../domain/staff.queries';
import { StaffRole } from '../domain/staff-role.value-object';
import { StaffUser } from '../domain/staff-user.entity';

export interface StaffUserRow {
  readonly id: string;
  readonly full_name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly showroom_id: string | null;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export function toStaffUser(row: StaffUserRow, roleNames: readonly string[]): StaffUser | null {
  const staffRoles = toStaffRoles(roleNames);
  if (staffRoles.length === 0) {
    return null;
  }
  if (row.phone === null) {
    throw new DataIntegrityError(`Staff user ${row.id} is missing a phone number`);
  }

  return StaffUser.reconstitute({
    id: toUserId(row.id),
    fullName: row.full_name,
    phone: Phone.create(row.phone),
    email: row.email,
    showroomId: row.showroom_id,
    roles: staffRoles,
    createdAt: new Date(row.created_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  });
}

export function toStaffMemberReadModel(
  row: StaffUserRow,
  roleNames: readonly string[],
): StaffMemberReadModel | null {
  const staffRoles = toStaffRoles(roleNames);
  if (staffRoles.length === 0 || row.phone === null || row.deleted_at !== null) {
    return null;
  }

  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    showroomId: row.showroom_id,
    roles: staffRoles.map((role) => role.name),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toStaffRoles(roleNames: readonly string[]): StaffRole[] {
  const roles: StaffRole[] = [];
  for (const name of roleNames) {
    try {
      roles.push(StaffRole.create(name));
    } catch {
      // Owner/buyer and unknown catalog names are ignored on the staff aggregate.
    }
  }
  return roles;
}
