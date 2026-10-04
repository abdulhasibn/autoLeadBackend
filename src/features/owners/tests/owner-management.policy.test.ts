import { describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { toUserId } from '../../../domain/shared/user-id';
import { OwnerManagementPolicy } from '../application/policies/owner-management.policy';

describe('OwnerManagementPolicy', () => {
  const policy = new OwnerManagementPolicy();

  it('allows an admin to manage owners', () => {
    expect(() =>
      policy.requireAdminOrSalesperson({
        userId: toUserId('admin-1'),
        roles: ['admin'],
        showroomId: null,
      }),
    ).not.toThrow();
  });

  it('allows a salesperson to manage owners', () => {
    expect(() =>
      policy.requireAdminOrSalesperson({
        userId: toUserId('sales-1'),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).not.toThrow();
  });

  it('rejects a buyer from managing owners', () => {
    expect(() =>
      policy.requireAdminOrSalesperson({
        userId: toUserId('buyer-1'),
        roles: ['buyer'],
        showroomId: null,
      }),
    ).toThrow(ForbiddenActionError);
  });

  it('allows an admin to deactivate', () => {
    expect(() =>
      policy.requireAdmin({ userId: toUserId('admin-1'), roles: ['admin'], showroomId: null }),
    ).not.toThrow();
  });

  it('rejects a salesperson from deactivating', () => {
    expect(() =>
      policy.requireAdmin({
        userId: toUserId('sales-1'),
        roles: ['salesperson'],
        showroomId: null,
      }),
    ).toThrow(ForbiddenActionError);
  });
});
