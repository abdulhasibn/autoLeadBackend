import { ForbiddenActionError } from '../errors/forbidden-action.error';
import type { AuthenticatedContext } from './auth-context';

export const ROLE = {
  ADMIN: 'admin',
  SALESPERSON: 'salesperson',
  OWNER: 'owner',
  BUYER: 'buyer',
} as const;

export type RoleName = (typeof ROLE)[keyof typeof ROLE];

export const STAFF_ROLES: readonly RoleName[] = [ROLE.ADMIN, ROLE.SALESPERSON];

export function hasAnyRole(ctx: AuthenticatedContext, roles: readonly RoleName[]): boolean {
  return roles.some((role) => ctx.roles.includes(role));
}

export function isAdmin(ctx: AuthenticatedContext): boolean {
  return hasAnyRole(ctx, [ROLE.ADMIN]);
}

export function requireAnyRole(
  ctx: AuthenticatedContext,
  roles: readonly RoleName[],
  message: string,
): void {
  if (!hasAnyRole(ctx, roles)) {
    throw new ForbiddenActionError(message);
  }
}
