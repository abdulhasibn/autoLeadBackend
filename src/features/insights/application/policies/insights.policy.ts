import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, requireAnyRole } from '../../../../domain/shared/role';
import { toShowroomId, type ShowroomId } from '../../../../domain/shared/showroom-id';

/**
 * Insights are the owner's view of marketing and pricing: admins only.
 * Salespeople get 403 (they see their own numbers on the dashboard).
 */
export class InsightsPolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only admins can view insights');
  }

  /** All showrooms unless the admin names one. */
  showroom(requestedShowroomId: string | undefined): ShowroomId | null {
    return requestedShowroomId === undefined ? null : toShowroomId(requestedShowroomId);
  }
}
