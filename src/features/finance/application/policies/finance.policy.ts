import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { ROLE, requireAnyRole } from '../../../../domain/shared/role';

/**
 * Finance is Admin-only (ADR-0014). Holding an unlocked session is checked
 * separately by FinanceSessionService.
 */
export class FinancePolicy {
  requireAdmin(ctx: AuthenticatedContext): void {
    requireAnyRole(ctx, [ROLE.ADMIN], 'Only an admin can use finance');
  }
}
