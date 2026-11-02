import { describe, expect, it } from 'vitest';

import { toUserId } from '../../../domain/shared/user-id';
import { toFinanceVaultId } from '../domain/finance-vault-id';
import { FinanceVault } from '../domain/finance-vault.entity';
import { TEST_KDF } from './fakes';

const T0 = new Date('2026-11-02T10:00:00.000Z');

function minutes(n: number): Date {
  return new Date(T0.getTime() + n * 60_000);
}

function pendingVault(): FinanceVault {
  return FinanceVault.createPending({
    id: toFinanceVaultId('11111111-1111-4111-8111-000000000001'),
    kdf: TEST_KDF,
    financeWrap: { salt: 's1', wrappedKey: 'v1.a' },
    recoveryWrap: { salt: 's2', wrappedKey: 'v1.b' },
    keyVersion: 1,
    createdBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    now: T0,
  });
}

describe('FinanceVault', () => {
  it('starts pending and becomes active once confirmed', () => {
    const vault = pendingVault();
    expect(vault.isActive).toBe(false);

    vault.confirm(minutes(1));

    expect(vault.isActive).toBe(true);
    expect(vault.confirmedAt).toEqual(minutes(1));
    expect(() => vault.confirm(minutes(2))).toThrow();
  });

  it('blocks unlock for 15 minutes on the fifth failure inside the window', () => {
    const vault = pendingVault();
    for (let i = 0; i < 4; i++) {
      vault.recordFailedUnlock(minutes(i));
    }
    expect(vault.isUnlockBlocked(minutes(4))).toBe(false);

    vault.recordFailedUnlock(minutes(4));

    expect(vault.isUnlockBlocked(minutes(4))).toBe(true);
    expect(vault.minutesUntilUnblocked(minutes(5))).toBe(14);
    expect(vault.isUnlockBlocked(minutes(19))).toBe(false);
    expect(vault.failedUnlocks).toBe(0);
  });

  it('starts a new count when the last failure is older than the window', () => {
    const vault = pendingVault();
    for (let i = 0; i < 4; i++) {
      vault.recordFailedUnlock(minutes(i));
    }

    vault.recordFailedUnlock(minutes(30));

    expect(vault.failedUnlocks).toBe(1);
    expect(vault.isUnlockBlocked(minutes(30))).toBe(false);
  });

  it('clears the count on a successful unlock and reports whether it changed', () => {
    const vault = pendingVault();
    expect(vault.recordSuccessfulUnlock(T0)).toBe(false);

    vault.recordFailedUnlock(T0);

    expect(vault.recordSuccessfulUnlock(minutes(1))).toBe(true);
    expect(vault.failedUnlocks).toBe(0);
    expect(vault.lastFailedUnlockAt).toBeNull();
  });
});
