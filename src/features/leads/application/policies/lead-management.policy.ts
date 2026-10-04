import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, STAFF_ROLES, isAdmin, requireAnyRole } from '../../../../domain/shared/role';
import type { UserId } from '../../../../domain/shared/user-id';

interface WorkableLead {
  readonly id: string;
  readonly assignedTo: string | null;
}

/**
 * Admins work every lead and own assignment. A salesperson works only the
 * leads assigned to them; other leads look like they do not exist so the
 * API never confirms their ids. Roles come from the authenticated context.
 */
export class LeadManagementPolicy {
  requireStaff(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, STAFF_ROLES, 'Only staff can manage leads');
  }

  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only an admin can assign leads');
  }

  requireCanWork(ctx: AuthenticatedContext, lead: WorkableLead): void {
    if (isAdmin(ctx) || lead.assignedTo === ctx.userId) {
      return;
    }
    throw new NotFoundError(`Lead not found for id ${lead.id}`);
  }

  /** The assignee filter a list must apply: admins choose, salespersons see their own. */
  assigneeScope(ctx: AuthenticatedContext, requested: UserId | undefined): UserId | undefined {
    return isAdmin(ctx) ? requested : ctx.userId;
  }

  /** A lead created by a salesperson is theirs; an admin's lead starts unassigned. */
  initialAssignee(ctx: AuthenticatedContext): UserId | null {
    return isAdmin(ctx) ? null : ctx.userId;
  }
}
