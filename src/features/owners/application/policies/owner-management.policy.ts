import { ForbiddenActionError } from '../../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';

/**
 * Owner CRUD is Admin or Salesperson. Deactivate is Admin-only.
 * Roles come from the JWT context, never from the request body.
 */
export class OwnerManagementPolicy {
  requireAdminOrSalesperson(ctx: AuthenticatedContext): void {
    if (!ctx.roles.includes('admin') && !ctx.roles.includes('salesperson')) {
      throw new ForbiddenActionError('Only staff can manage owners');
    }
  }

  requireAdmin(ctx: AuthenticatedContext): void {
    if (!ctx.roles.includes('admin')) {
      throw new ForbiddenActionError('Only an admin can deactivate an owner');
    }
  }
}
