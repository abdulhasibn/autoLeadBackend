import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { STAFF_ROLES, requireAnyRole } from '../../../../domain/shared/role';

/** Every staff member may read the showroom directory. */
export class ShowroomDirectoryPolicy {
  requireStaff(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, STAFF_ROLES, 'Only staff can list showrooms');
  }
}
