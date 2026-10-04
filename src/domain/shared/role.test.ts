import { describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../errors/forbidden-action.error';
import type { AuthenticatedContext } from './auth-context';
import { ROLE, STAFF_ROLES, hasAnyRole, isAdmin, requireAnyRole } from './role';
import { toUserId } from './user-id';

function ctx(roles: string[]): AuthenticatedContext {
  return { userId: toUserId('user-1'), roles, showroomId: null };
}

describe('role helpers', () => {
  it('matches any of the listed roles', () => {
    expect(hasAnyRole(ctx(['salesperson']), STAFF_ROLES)).toBe(true);
    expect(hasAnyRole(ctx(['buyer']), STAFF_ROLES)).toBe(false);
    expect(hasAnyRole(ctx([]), [ROLE.ADMIN])).toBe(false);
  });

  it('identifies admins', () => {
    expect(isAdmin(ctx(['salesperson', 'admin']))).toBe(true);
    expect(isAdmin(ctx(['salesperson']))).toBe(false);
  });

  it('throws ForbiddenActionError with the given message when no role matches', () => {
    expect(() => requireAnyRole(ctx(['owner']), [ROLE.ADMIN], 'Admins only')).toThrow(
      new ForbiddenActionError('Admins only'),
    );
    expect(() => requireAnyRole(ctx(['admin']), [ROLE.ADMIN], 'Admins only')).not.toThrow();
  });
});
