import { describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';

const policy = new VehicleManagementPolicy();

describe('VehicleManagementPolicy', () => {
  it('allows an admin', () => {
    const ctx: AuthenticatedContext = {
      userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      roles: ['admin'],
    };
    expect(() => policy.requireAdmin(ctx)).not.toThrow();
  });

  it('rejects a salesperson', () => {
    const ctx: AuthenticatedContext = {
      userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      roles: ['salesperson'],
    };
    expect(() => policy.requireAdmin(ctx)).toThrow(ForbiddenActionError);
  });
});
