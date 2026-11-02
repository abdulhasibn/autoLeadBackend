import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import type { IdGenerator } from '../../../shared/ids/id-generator';
import { FinancePolicy } from '../application/policies/finance.policy';
import { FinanceSessionService } from '../application/services/finance-session.service';
import { VaultKeyring } from '../application/services/vault-keyring';
import type { FinanceAuditAction, IFinanceAuditLog } from '../domain/finance-audit-log.port';
import type { KdfParams } from '../domain/finance-crypto.port';
import type { FinanceSessionId } from '../domain/finance-session-id';
import { FinanceSession } from '../domain/finance-session.entity';
import type { IFinanceSessionRepository } from '../domain/finance-session.repository';
import type { FinanceVaultId } from '../domain/finance-vault-id';
import { FinanceVault } from '../domain/finance-vault.entity';
import type {
  FinanceVaultStateReadModel,
  IFinanceVaultQueries,
} from '../domain/finance-vault.queries';
import type { IFinanceVaultRepository } from '../domain/finance-vault.repository';
import { NodeFinanceCrypto } from '../infrastructure/node-finance-crypto';

/** Cheap scrypt cost so tests run fast; production uses DEFAULT_KDF_PARAMS. */
export const TEST_KDF: KdfParams = { algorithm: 'scrypt', n: 2 ** 10, r: 8, p: 1, keyLength: 32 };

export const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

export const OTHER_ADMIN: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['admin'],
  showroomId: null,
};

export const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  roles: ['salesperson'],
  showroomId: null,
};

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private next = 1;

  generate(): string {
    const suffix = String(this.next++).padStart(12, '0');
    return `11111111-1111-4111-8111-${suffix}`;
  }
}

/** Stores copies so a test only sees what was explicitly saved. */
export class InMemoryFinanceVaultRepository implements IFinanceVaultRepository {
  stored: FinanceVault | null = null;

  async find(): Promise<FinanceVault | null> {
    return this.stored === null ? null : copyVault(this.stored);
  }

  async save(vault: FinanceVault): Promise<void> {
    this.stored = copyVault(vault);
  }

  async delete(id: FinanceVaultId): Promise<void> {
    if (this.stored?.id === id) {
      this.stored = null;
    }
  }
}

/** Reads the same store as the repository, as the real queries read the same table. */
export class InMemoryFinanceVaultQueries implements IFinanceVaultQueries {
  constructor(private readonly vaults: InMemoryFinanceVaultRepository) {}

  async getVaultState(): Promise<FinanceVaultStateReadModel | null> {
    const vault = this.vaults.stored;
    return vault === null ? null : { status: vault.status };
  }
}

export class InMemoryFinanceSessionRepository implements IFinanceSessionRepository {
  readonly store = new Map<string, FinanceSession>();

  async findById(id: FinanceSessionId): Promise<FinanceSession | null> {
    const session = this.store.get(id);
    return session === undefined ? null : copySession(session);
  }

  async save(session: FinanceSession): Promise<void> {
    this.store.set(session.id, copySession(session));
  }

  async delete(id: FinanceSessionId): Promise<void> {
    this.store.delete(id);
  }

  async deleteAll(): Promise<void> {
    this.store.clear();
  }

  async deleteAllExcept(id: FinanceSessionId): Promise<void> {
    for (const key of [...this.store.keys()]) {
      if (key !== id) {
        this.store.delete(key);
      }
    }
  }

  async deleteExpired(now: Date): Promise<void> {
    for (const [key, session] of [...this.store.entries()]) {
      if (session.isExpired(now)) {
        this.store.delete(key);
      }
    }
  }
}

export class FakeFinanceAuditLog implements IFinanceAuditLog {
  readonly actions: FinanceAuditAction[] = [];

  async record(entry: { readonly action: FinanceAuditAction }): Promise<void> {
    this.actions.push(entry.action);
  }
}

export interface FinanceTestKit {
  readonly clock: FakeClock;
  readonly ids: SequentialIdGenerator;
  readonly crypto: NodeFinanceCrypto;
  readonly vaults: InMemoryFinanceVaultRepository;
  readonly vaultQueries: InMemoryFinanceVaultQueries;
  readonly sessions: InMemoryFinanceSessionRepository;
  readonly audit: FakeFinanceAuditLog;
  readonly policy: FinancePolicy;
  readonly keyring: VaultKeyring;
  readonly sessionService: FinanceSessionService;
}

export function createFinanceTestKit(now = new Date('2026-11-02T10:00:00.000Z')): FinanceTestKit {
  const clock = new FakeClock(now);
  const ids = new SequentialIdGenerator();
  const crypto = new NodeFinanceCrypto();
  const vaults = new InMemoryFinanceVaultRepository();
  const sessions = new InMemoryFinanceSessionRepository();
  const audit = new FakeFinanceAuditLog();
  return {
    clock,
    ids,
    crypto,
    vaults,
    vaultQueries: new InMemoryFinanceVaultQueries(vaults),
    sessions,
    audit,
    policy: new FinancePolicy(),
    keyring: new VaultKeyring(vaults, crypto, clock, audit),
    sessionService: new FinanceSessionService(sessions, crypto, clock, ids),
  };
}

function copyVault(vault: FinanceVault): FinanceVault {
  return FinanceVault.reconstitute({
    id: vault.id,
    status: vault.status,
    kdf: vault.kdf,
    financeWrap: vault.financeWrap,
    recoveryWrap: vault.recoveryWrap,
    keyVersion: vault.keyVersion,
    failedUnlocks: vault.failedUnlocks,
    lastFailedUnlockAt: vault.lastFailedUnlockAt,
    unlockBlockedUntil: vault.unlockBlockedUntil,
    createdBy: vault.createdBy,
    confirmedAt: vault.confirmedAt,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
  });
}

function copySession(session: FinanceSession): FinanceSession {
  return FinanceSession.reconstitute({
    id: session.id,
    userId: session.userId,
    wrappedKey: session.wrappedKey,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    idleExpiresAt: session.idleExpiresAt,
    expiresAt: session.expiresAt,
  });
}
