import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, STAFF_ROLES, requireAnyRole } from '../../../../domain/shared/role';

/**
 * Owner CRUD is Admin or Salesperson. Deactivate is Admin-only.
 * Roles come from the JWT context, never from the request body.
 */
export class OwnerManagementPolicy {
  requireAdminOrSalesperson(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, STAFF_ROLES, 'Only staff can manage owners');
  }

  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only an admin can deactivate an owner');
  }
}
