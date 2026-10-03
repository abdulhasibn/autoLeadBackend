import { ForbiddenActionError } from '../../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';

/**
 * Vehicle intake is Admin-only in this phase. Roles come from the
 * authenticated context, never from the request body.
 */
export class VehicleManagementPolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    if (!ctx.roles.includes('admin')) {
      throw new ForbiddenActionError('Only an admin can manage vehicles');
    }
  }
}
