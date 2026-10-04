import { BusinessRuleViolationError } from '../errors/business-rule-violation.error';
import { ForbiddenActionError } from '../errors/forbidden-action.error';
import type { AuthenticatedContext } from './auth-context';
import { isAdmin } from './role';
import { type ShowroomId, toShowroomId } from './showroom-id';

/**
 * Picks the showroom a new record belongs to. The actor's home showroom wins;
 * only an admin may file a record under a different showroom. Actors without
 * a home showroom must name one explicitly.
 */
export function resolveShowroomId(ctx: AuthenticatedContext, requested: string | null): ShowroomId {
  if (ctx.showroomId !== null) {
    if (requested === null || requested === ctx.showroomId) {
      return ctx.showroomId;
    }
    if (!isAdmin(ctx)) {
      throw new ForbiddenActionError('You can only create records in your own showroom');
    }
    return toShowroomId(requested);
  }
  if (requested === null) {
    throw new BusinessRuleViolationError(
      'SHOWROOM_REQUIRED',
      'showroomId is required because your account has no home showroom',
    );
  }
  return toShowroomId(requested);
}
