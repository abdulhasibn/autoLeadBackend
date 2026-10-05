import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, requireAnyRole } from '../../../../domain/shared/role';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { DashboardScope } from '../../domain/dashboard.queries';

/**
 * Admins are the only staff working leads today, so the dashboard is
 * admin-only and covers every lead in the chosen showroom (or all showrooms).
 */
export class DashboardPolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only an admin can view the dashboard');
  }

  scope(requestedShowroomId: string | undefined): DashboardScope {
    return {
      showroomId: requestedShowroomId === undefined ? null : toShowroomId(requestedShowroomId),
      assigneeId: null,
    };
  }
}
