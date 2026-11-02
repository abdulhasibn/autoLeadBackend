import { describe, expect, it } from 'vitest';

import { toUserId } from '../../../domain/shared/user-id';
import { toFinanceSessionId } from '../domain/finance-session-id';
import { FinanceSession } from '../domain/finance-session.entity';

const T0 = new Date('2026-11-02T10:00:00.000Z');
const MINUTE = 60_000;

function minutes(n: number): Date {
  return new Date(T0.getTime() + n * MINUTE);
}

function startSession(): FinanceSession {
  return FinanceSession.start({
    id: toFinanceSessionId('11111111-1111-4111-8111-000000000001'),
    userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    wrappedKey: 'v1.x',
    now: T0,
    idleMs: 30 * MINUTE,
    absoluteMs: 60 * MINUTE,
  });
}

describe('FinanceSession', () => {
  it('expires after the idle period without activity', () => {
    const session = startSession();

    expect(session.isExpired(minutes(29))).toBe(false);
    expect(session.isExpired(minutes(30))).toBe(true);
  });

  it('slides the idle expiry on use but never past the fixed lifetime', () => {
    const session = startSession();

    session.touch(minutes(20), 30 * MINUTE);
    expect(session.idleExpiresAt).toEqual(minutes(50));
    expect(session.isExpired(minutes(45))).toBe(false);

    session.touch(minutes(45), 30 * MINUTE);
    expect(session.idleExpiresAt).toEqual(minutes(60));
    expect(session.isExpired(minutes(60))).toBe(true);
  });

  it('belongs only to the admin who unlocked', () => {
    const session = startSession();

    expect(session.belongsTo(toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'))).toBe(true);
    expect(session.belongsTo(toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))).toBe(false);
  });
});
