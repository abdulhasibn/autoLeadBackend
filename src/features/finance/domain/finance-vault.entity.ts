import type { UserId } from '../../../domain/shared/user-id';
import type { FinanceVaultId } from './finance-vault-id';
import type { KdfParams } from './finance-crypto.port';
import { FAILED_UNLOCK_WINDOW_MS, MAX_FAILED_UNLOCKS, UNLOCK_BLOCK_MS } from './finance.constants';

export type FinanceVaultStatus = 'pending' | 'active';

/** The data key wrapped by one secret (finance key or recovery key). */
export interface KeyWrap {
  readonly salt: string;
  readonly wrappedKey: string;
}

export interface FinanceVaultProps {
  readonly id: FinanceVaultId;
  readonly status: FinanceVaultStatus;
  readonly kdf: KdfParams;
  readonly financeWrap: KeyWrap;
  readonly recoveryWrap: KeyWrap;
  readonly keyVersion: number;
  readonly failedUnlocks: number;
  readonly lastFailedUnlockAt: Date | null;
  readonly unlockBlockedUntil: Date | null;
  readonly createdBy: UserId;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * The business's finance vault (ADR-0014). It never holds a key in plaintext,
 * only the data key wrapped by the finance key and by the recovery key, plus
 * the unlock lockout state. A new vault is `pending` until the admin proves
 * they saved the recovery key.
 */
export class FinanceVault {
  private constructor(private props: FinanceVaultProps) {}

  static createPending(input: {
    id: FinanceVaultId;
    kdf: KdfParams;
    financeWrap: KeyWrap;
    recoveryWrap: KeyWrap;
    keyVersion: number;
    createdBy: UserId;
    now: Date;
  }): FinanceVault {
    return new FinanceVault({
      id: input.id,
      status: 'pending',
      kdf: input.kdf,
      financeWrap: input.financeWrap,
      recoveryWrap: input.recoveryWrap,
      keyVersion: input.keyVersion,
      failedUnlocks: 0,
      lastFailedUnlockAt: null,
      unlockBlockedUntil: null,
      createdBy: input.createdBy,
      confirmedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static reconstitute(props: FinanceVaultProps): FinanceVault {
    return new FinanceVault(props);
  }

  get id(): FinanceVaultId {
    return this.props.id;
  }
  get status(): FinanceVaultStatus {
    return this.props.status;
  }
  get isActive(): boolean {
    return this.props.status === 'active';
  }
  get kdf(): KdfParams {
    return this.props.kdf;
  }
  get financeWrap(): KeyWrap {
    return this.props.financeWrap;
  }
  get recoveryWrap(): KeyWrap {
    return this.props.recoveryWrap;
  }
  get keyVersion(): number {
    return this.props.keyVersion;
  }
  get failedUnlocks(): number {
    return this.props.failedUnlocks;
  }
  get lastFailedUnlockAt(): Date | null {
    return this.props.lastFailedUnlockAt;
  }
  get unlockBlockedUntil(): Date | null {
    return this.props.unlockBlockedUntil;
  }
  get createdBy(): UserId {
    return this.props.createdBy;
  }
  get confirmedAt(): Date | null {
    return this.props.confirmedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  confirm(now: Date): void {
    if (this.isActive) {
      throw new Error('Finance vault is already confirmed');
    }
    this.props = { ...this.props, status: 'active', confirmedAt: now, updatedAt: now };
  }

  isUnlockBlocked(now: Date): boolean {
    const until = this.props.unlockBlockedUntil;
    return until !== null && until.getTime() > now.getTime();
  }

  /** Whole minutes until unlock is allowed again (at least 1 while blocked). */
  minutesUntilUnblocked(now: Date): number {
    const until = this.props.unlockBlockedUntil;
    if (until === null) {
      return 0;
    }
    return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  }

  /**
   * Counts a wrong key. A failure outside the window starts a new count; the
   * limit-th failure blocks unlock and clears the count.
   */
  recordFailedUnlock(now: Date): void {
    const last = this.props.lastFailedUnlockAt;
    const withinWindow = last !== null && now.getTime() - last.getTime() < FAILED_UNLOCK_WINDOW_MS;
    const failedUnlocks = (withinWindow ? this.props.failedUnlocks : 0) + 1;

    if (failedUnlocks >= MAX_FAILED_UNLOCKS) {
      this.props = {
        ...this.props,
        failedUnlocks: 0,
        lastFailedUnlockAt: now,
        unlockBlockedUntil: new Date(now.getTime() + UNLOCK_BLOCK_MS),
        updatedAt: now,
      };
      return;
    }
    this.props = { ...this.props, failedUnlocks, lastFailedUnlockAt: now, updatedAt: now };
  }

  /** Returns true when lockout state changed and the vault needs saving. */
  recordSuccessfulUnlock(now: Date): boolean {
    if (this.props.failedUnlocks === 0 && this.props.unlockBlockedUntil === null) {
      return false;
    }
    this.props = {
      ...this.props,
      failedUnlocks: 0,
      lastFailedUnlockAt: null,
      unlockBlockedUntil: null,
      updatedAt: now,
    };
    return true;
  }

  replaceFinanceWrap(wrap: KeyWrap, now: Date): void {
    this.props = { ...this.props, financeWrap: wrap, updatedAt: now };
  }

  replaceRecoveryWrap(wrap: KeyWrap, now: Date): void {
    this.props = { ...this.props, recoveryWrap: wrap, updatedAt: now };
  }
}
