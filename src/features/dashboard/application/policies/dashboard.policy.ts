import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { STAFF_ROLES, isAdmin, requireAnyRole } from '../../../../domain/shared/role';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { DashboardScope } from '../../domain/dashboard.queries';

/**
 * Admins see every lead in the chosen showroom (or all showrooms). A
 * salesperson sees only the leads assigned to them, and any showroom they
 * ask for is ignored.
 */
export class DashboardPolicy {
  requireStaff(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, STAFF_ROLES, 'Only staff can view the dashboard');
  }

  scope(ctx: AuthenticatedContext, requestedShowroomId: string | undefined): DashboardScope {
    if (!isAdmin(ctx)) {
      return { showroomId: null, assigneeId: ctx.userId };
    }
    return {
      showroomId: requestedShowroomId === undefined ? null : toShowroomId(requestedShowroomId),
      assigneeId: null,
    };
  }
}
