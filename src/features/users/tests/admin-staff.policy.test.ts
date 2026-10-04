import { describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { toUserId } from '../../../domain/shared/user-id';
import { AdminStaffPolicy } from '../application/policies/admin-staff.policy';

describe('AdminStaffPolicy', () => {
  const policy = new AdminStaffPolicy();

  it('allows an admin', () => {
    expect(() =>
      policy.requireAdmin({ userId: toUserId('admin-1'), roles: ['admin'], showroomId: null }),
    ).not.toThrow();
  });

  it('rejects a salesperson', () => {
    expect(() =>
      policy.requireAdmin({
        userId: toUserId('sales-1'),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).toThrow(ForbiddenActionError);
  });

  it('rejects a user with no roles', () => {
    expect(() =>
      policy.requireAdmin({ userId: toUserId('user-1'), roles: [], showroomId: null }),
    ).toThrow(ForbiddenActionError);
  });
});
