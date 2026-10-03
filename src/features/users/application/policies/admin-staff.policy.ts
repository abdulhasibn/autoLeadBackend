import { ForbiddenActionError } from '../../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';

/**
 * Staff management is Admin-only. Roles come from the JWT context, never
 * from the request body.
 */
export class AdminStaffPolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    if (!ctx.roles.includes('admin')) {
      throw new ForbiddenActionError('Only an admin can manage staff');
    }
  }
}
