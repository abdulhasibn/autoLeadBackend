import { describe, expect, it } from 'vitest';

import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { StaffRole } from '../domain/staff-role.value-object';
import { StaffUser } from '../domain/staff-user.entity';

const CREATED_AT = new Date('2026-09-10T00:00:00.000Z');

function makeStaff(roles: StaffRole[] = [StaffRole.salesperson()]): StaffUser {
  return StaffUser.create({
    id: toUserId('11111111-1111-4111-8111-111111111111'),
    fullName: '  Ada Lovelace  ',
    phone: Phone.create('+919876543210'),
    email: ' ada@example.com ',
    showroomId: null,
    roles,
    createdAt: CREATED_AT,
  });
}

describe('StaffUser entity', () => {
  it('trims full name and email on create', () => {
    const staff = makeStaff();
    expect(staff.fullName).toBe('Ada Lovelace');
    expect(staff.email).toBe('ada@example.com');
  });

  it('rejects create with no roles', () => {
    expect(() => makeStaff([])).toThrow('at least one role');
  });

  it('rejects an empty full name', () => {
    expect(() =>
      StaffUser.create({
        id: toUserId('11111111-1111-4111-8111-111111111111'),
        fullName: '   ',
        phone: Phone.create('+919876543210'),
        email: null,
        showroomId: null,
        roles: [StaffRole.admin()],
        createdAt: CREATED_AT,
      }),
    ).toThrow('Full name cannot be empty');
  });

  it('assigns a new role and ignores a duplicate', () => {
    const staff = makeStaff();
    staff.assignRole(StaffRole.admin());
    staff.assignRole(StaffRole.admin());
    expect(staff.liveRoles.map((role) => role.name)).toEqual(['salesperson', 'admin']);
  });

  it('refuses to revoke the last remaining role', () => {
    const staff = makeStaff();
    expect(() => staff.revokeRole(StaffRole.salesperson())).toThrow('at least one role');
  });

  it('replaces the role set', () => {
    const staff = makeStaff();
    staff.replaceRoles([StaffRole.admin()]);
    expect(staff.liveRoles.map((role) => role.name)).toEqual(['admin']);
  });

  it('deactivates and clears live roles', () => {
    const staff = makeStaff([StaffRole.admin(), StaffRole.salesperson()]);
    const at = new Date('2026-09-10T12:00:00.000Z');
    staff.deactivate(at);
    expect(staff.isDeactivated).toBe(true);
    expect(staff.deletedAt).toEqual(at);
    expect(staff.liveRoles).toEqual([]);
  });

  it('refuses profile updates after deactivation', () => {
    const staff = makeStaff();
    staff.deactivate(CREATED_AT);
    expect(() =>
      staff.updateProfile({
        fullName: 'Ada',
        phone: Phone.create('+919876543210'),
        email: null,
        showroomId: null,
      }),
    ).toThrow('deactivated');
  });
});
