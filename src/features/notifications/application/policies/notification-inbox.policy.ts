import { ForbiddenActionError } from '../../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';

export class NotificationInboxPolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    if (!ctx.roles.includes('admin')) {
      throw new ForbiddenActionError('Only an admin can read notifications');
    }
  }
}
