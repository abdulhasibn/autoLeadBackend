import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { STAFF_ROLES, requireAnyRole } from '../../../../domain/shared/role';

/**
 * Every staff member reads their own inbox; queries are always filtered by
 * the actor's user id.
 */
export class NotificationInboxPolicy {
  requireStaff(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, STAFF_ROLES, 'Only staff can read notifications');
  }
}
