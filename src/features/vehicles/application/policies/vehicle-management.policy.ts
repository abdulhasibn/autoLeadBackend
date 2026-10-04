import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, STAFF_ROLES, requireAnyRole } from '../../../../domain/shared/role';

/**
 * Admin and Salesperson handle vehicle intake (details, media, documents).
 * Status changes and deletions stay Admin-only. Roles come from the
 * authenticated context, never from the request body.
 */
export class VehicleManagementPolicy {
  requireStaff(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, STAFF_ROLES, 'Only staff can manage vehicles');
  }

  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only an admin can perform this vehicle action');
  }
}
