import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../errors/business-rule-violation.error';
import { ForbiddenActionError } from '../errors/forbidden-action.error';
import type { AuthenticatedContext } from './auth-context';
import { resolveShowroomId } from './resolve-showroom';
import { type ShowroomId, toShowroomId } from './showroom-id';
import { toUserId } from './user-id';

const HOME = toShowroomId('showroom-home');
const OTHER = 'showroom-other';

function ctx(roles: string[], showroomId: ShowroomId | null): AuthenticatedContext {
  return { userId: toUserId('user-1'), roles, showroomId };
}

describe('resolveShowroomId', () => {
  it('defaults to the actor home showroom', () => {
    expect(resolveShowroomId(ctx(['salesperson'], HOME), null)).toBe(HOME);
    expect(resolveShowroomId(ctx(['salesperson'], HOME), HOME)).toBe(HOME);
  });

  it('lets only an admin file under another showroom', () => {
    expect(resolveShowroomId(ctx(['admin'], HOME), OTHER)).toBe(OTHER);
    expect(() => resolveShowroomId(ctx(['salesperson'], HOME), OTHER)).toThrow(
      ForbiddenActionError,
    );
  });

  it('uses the requested showroom when the actor has none', () => {
    expect(resolveShowroomId(ctx(['admin'], null), OTHER)).toBe(OTHER);
  });

  it('requires a showroom when neither the actor nor the request has one', () => {
    expect(() => resolveShowroomId(ctx(['admin'], null), null)).toThrow(BusinessRuleViolationError);
  });
});
