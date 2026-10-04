import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, requireAnyRole } from '../../../../domain/shared/role';

/**
 * Staff management is Admin-only. Roles come from the JWT context, never
 * from the request body.
 */
export class AdminStaffPolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only an admin can manage staff');
  }
}
