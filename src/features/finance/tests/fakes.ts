import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import type { IdGenerator } from '../../../shared/ids/id-generator';
import { FinancePolicy } from '../application/policies/finance.policy';
import { DefaultTagSeeder } from '../application/services/default-tag-seeder';
import { EntrySealer } from '../application/services/entry.sealer';
import { FinanceSessionService } from '../application/services/finance-session.service';
import { TagSealer } from '../application/services/tag.sealer';
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
import type { FinanceEntryId } from '../domain/finance-entry-id';
import type {
  FinanceEntryCriteria,
  IFinanceEntryQueries,
  SealedEntryPage,
} from '../domain/finance-entry.queries';
import type { IFinanceEntryRepository } from '../domain/finance-entry.repository';
import type { FinanceTagId } from '../domain/finance-tag-id';
import type { IFinanceTagQueries } from '../domain/finance-tag.queries';
import type { IFinanceTagRepository } from '../domain/finance-tag.repository';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
  SoldVehicleFacts,
} from '../domain/finance-vehicle-lookup.port';
import type {
  SealedFinanceEntry,
  SealedFinanceTag,
  SealedVehicleDeal,
  SealedVehicleQuote,
} from '../domain/sealed-finance-records';
import type { IVehicleDealQueries } from '../domain/vehicle-deal.queries';
import type { IVehicleDealRepository } from '../domain/vehicle-deal.repository';
import type { VehicleQuoteId } from '../domain/vehicle-quote-id';
import type { IVehicleQuoteQueries } from '../domain/vehicle-quote.queries';
import type { IVehicleQuoteRepository } from '../domain/vehicle-quote.repository';
import { QuoteSealer } from '../application/services/quote.sealer';
import { VehicleDealSealer } from '../application/services/vehicle-deal.sealer';
import { NodeFinanceCrypto } from '../infrastructure/node-finance-crypto';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toVehicleId, type VehicleId } from '../../../domain/shared/vehicle-id';

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

/** Sealed entries; the repository and queries read the same store, like one table. */
export class InMemoryFinanceEntryStore implements IFinanceEntryRepository, IFinanceEntryQueries {
  readonly rows = new Map<string, SealedFinanceEntry>();

  async findById(id: FinanceEntryId): Promise<SealedFinanceEntry | null> {
    const row = this.rows.get(id);
    return row === undefined || row.deletedAt !== null ? null : row;
  }

  async save(entry: SealedFinanceEntry): Promise<void> {
    this.rows.set(entry.id, entry);
  }

  async list(criteria: FinanceEntryCriteria): Promise<SealedEntryPage> {
    const matched = [...this.rows.values()]
      .filter((row) => row.deletedAt === null)
      .filter((row) => criteria.from === undefined || row.entryDate >= criteria.from)
      .filter((row) => criteria.to === undefined || row.entryDate <= criteria.to)
      .filter((row) => criteria.kind === undefined || row.kind === criteria.kind)
      .filter((row) => criteria.showroomId === undefined || row.showroomId === criteria.showroomId)
      .filter((row) =>
        criteria.vehicleId !== undefined
          ? row.vehicleId === criteria.vehicleId
          : criteria.vehicleIds !== undefined
            ? row.vehicleId !== null && criteria.vehicleIds.includes(row.vehicleId)
            : criteria.unlinked === true
              ? row.vehicleId === null
              : true,
      );
    return {
      rows: matched.slice(0, criteria.maxRows),
      truncated: matched.length > criteria.maxRows,
    };
  }
}

export class InMemoryFinanceTagStore implements IFinanceTagRepository, IFinanceTagQueries {
  readonly rows = new Map<string, SealedFinanceTag>();

  async findAll(): Promise<readonly SealedFinanceTag[]> {
    return [...this.rows.values()];
  }

  async listAll(): Promise<readonly SealedFinanceTag[]> {
    return [...this.rows.values()];
  }

  async findById(id: FinanceTagId): Promise<SealedFinanceTag | null> {
    return this.rows.get(id) ?? null;
  }

  async findByIds(ids: readonly FinanceTagId[]): Promise<readonly SealedFinanceTag[]> {
    return ids.flatMap((id) => {
      const row = this.rows.get(id);
      return row === undefined ? [] : [row];
    });
  }

  async save(tag: SealedFinanceTag): Promise<void> {
    this.rows.set(tag.id, tag);
  }

  async saveMany(tags: readonly SealedFinanceTag[]): Promise<void> {
    for (const tag of tags) {
      this.rows.set(tag.id, tag);
    }
  }

  async count(): Promise<number> {
    return this.rows.size;
  }
}

export const SHOWROOM_A = toShowroomId('b0000000-0000-4000-8000-000000000001');
export const SHOWROOM_B = toShowroomId('b0000000-0000-4000-8000-000000000002');
export const SWIFT = toVehicleId('dddddddd-0000-4000-8000-000000000001');
export const CRETA = toVehicleId('dddddddd-0000-4000-8000-000000000002');
export const DELETED_CAR = toVehicleId('dddddddd-0000-4000-8000-000000000003');

export class FakeFinanceVehicleLookup implements IFinanceVehicleLookup {
  constructor(private readonly deals: InMemoryVehicleDealStore) {}

  readonly cars = new Map<string, FinanceVehicleFacts & { deleted: boolean; sold?: boolean }>([
    [
      SWIFT,
      { id: SWIFT, showroomId: SHOWROOM_A, label: 'Maruti Swift · KA01AB1234', deleted: false },
    ],
    [
      CRETA,
      { id: CRETA, showroomId: SHOWROOM_B, label: 'Hyundai Creta · KA05CD5678', deleted: false },
    ],
    [
      DELETED_CAR,
      { id: DELETED_CAR, showroomId: SHOWROOM_A, label: 'Honda City · KA02EF0001', deleted: true },
    ],
  ]);

  async findLinkable(id: VehicleId): Promise<FinanceVehicleFacts | null> {
    const car = this.cars.get(id);
    return car === undefined || car.deleted ? null : car;
  }

  async findMany(ids: readonly VehicleId[]): Promise<readonly FinanceVehicleFacts[]> {
    return ids.flatMap((id) => {
      const car = this.cars.get(id);
      return car === undefined ? [] : [car];
    });
  }

  async listSoldWithoutSale(): Promise<readonly SoldVehicleFacts[]> {
    return [...this.cars.values()]
      .filter((car) => car.sold === true && !car.deleted)
      .filter((car) => (this.deals.rows.get(car.id)?.soldOn ?? null) === null)
      .map((car) => ({
        id: car.id,
        showroomId: car.showroomId,
        label: car.label,
        soldLeadId: null,
      }));
  }
}

export class InMemoryVehicleDealStore implements IVehicleDealRepository, IVehicleDealQueries {
  readonly rows = new Map<string, SealedVehicleDeal>();

  async find(vehicleId: VehicleId): Promise<SealedVehicleDeal | null> {
    return this.rows.get(vehicleId) ?? null;
  }

  async findMany(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleDeal[]> {
    return vehicleIds.flatMap((id) => {
      const row = this.rows.get(id);
      return row === undefined ? [] : [row];
    });
  }

  async save(deal: SealedVehicleDeal): Promise<void> {
    this.rows.set(deal.vehicleId, deal);
  }
}

export class InMemoryVehicleQuoteStore implements IVehicleQuoteRepository, IVehicleQuoteQueries {
  readonly rows = new Map<string, SealedVehicleQuote>();

  async findById(id: VehicleQuoteId): Promise<SealedVehicleQuote | null> {
    const row = this.rows.get(id);
    return row === undefined || row.deletedAt !== null ? null : row;
  }

  async save(quote: SealedVehicleQuote): Promise<void> {
    this.rows.set(quote.id, quote);
  }

  async listForVehicles(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleQuote[]> {
    return [...this.rows.values()].filter(
      (row) => row.deletedAt === null && vehicleIds.includes(row.vehicleId),
    );
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
  readonly entries: InMemoryFinanceEntryStore;
  readonly tags: InMemoryFinanceTagStore;
  readonly vehicles: FakeFinanceVehicleLookup;
  readonly entrySealer: EntrySealer;
  readonly tagSealer: TagSealer;
  readonly tagSeeder: DefaultTagSeeder;
  readonly deals: InMemoryVehicleDealStore;
  readonly quotes: InMemoryVehicleQuoteStore;
  readonly dealSealer: VehicleDealSealer;
  readonly quoteSealer: QuoteSealer;
}

export function createFinanceTestKit(now = new Date('2026-11-02T10:00:00.000Z')): FinanceTestKit {
  const clock = new FakeClock(now);
  const ids = new SequentialIdGenerator();
  const crypto = new NodeFinanceCrypto();
  const vaults = new InMemoryFinanceVaultRepository();
  const sessions = new InMemoryFinanceSessionRepository();
  const audit = new FakeFinanceAuditLog();
  const tags = new InMemoryFinanceTagStore();
  const tagSealer = new TagSealer();
  const deals = new InMemoryVehicleDealStore();
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
    entries: new InMemoryFinanceEntryStore(),
    tags,
    vehicles: new FakeFinanceVehicleLookup(deals),
    entrySealer: new EntrySealer(),
    tagSealer,
    tagSeeder: new DefaultTagSeeder(tags, tagSealer, clock, ids),
    deals,
    quotes: new InMemoryVehicleQuoteStore(),
    dealSealer: new VehicleDealSealer(),
    quoteSealer: new QuoteSealer(),
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
