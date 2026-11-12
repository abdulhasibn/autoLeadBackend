import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { Money } from '../domain/money.value-object';
import type { SaleModel } from '../domain/sale-model';
import type { DealTerms } from '../domain/vehicle-deal.entity';
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
import { toLeadId, type LeadId } from '../../../domain/shared/lead-id';
import { toShowroomId, type ShowroomId } from '../../../domain/shared/showroom-id';
import type { FinanceLeadFacts, IFinanceLeadLookup } from '../domain/finance-lead-lookup.port';
import type { IFinanceLeadConversion } from '../domain/finance-lead-conversion.port';
import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
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
export const BALENO = toVehicleId('dddddddd-0000-4000-8000-000000000004');
export const LEAD_ANIL = toLeadId('eeeeeeee-0000-4000-8000-000000000001');
export const LEAD_DELETED = toLeadId('eeeeeeee-0000-4000-8000-000000000002');

export class FakeFinanceLeadLookup implements IFinanceLeadLookup {
  readonly leads = new Map<string, FinanceLeadFacts>([
    [LEAD_ANIL, { id: LEAD_ANIL, name: 'Anil Kumar', phone: '+919876500001', deleted: false }],
    [LEAD_DELETED, { id: LEAD_DELETED, name: 'Old Lead', phone: '+919876500002', deleted: true }],
  ]);
  /** Booking-confirmed leads per car; tests fill it in. */
  readonly booked = new Map<string, LeadId[]>();

  async listBookedForVehicle(vehicleId: VehicleId): Promise<readonly FinanceLeadFacts[]> {
    return this.findMany(this.booked.get(vehicleId) ?? []);
  }

  async findMany(ids: readonly LeadId[]): Promise<readonly FinanceLeadFacts[]> {
    return ids.flatMap((id) => {
      const lead = this.leads.get(id);
      return lead === undefined ? [] : [lead];
    });
  }
}

function car(
  id: VehicleId,
  showroomId: ShowroomId,
  label: string,
  status: string,
  deleted: boolean,
): FinanceVehicleFacts {
  return { id, showroomId, label, status, deleted, saleModel: 'purchase' };
}

export class FakeFinanceVehicleLookup implements IFinanceVehicleLookup {
  constructor(private readonly deals: InMemoryVehicleDealStore) {}

  /** Mutable so tests can change a car's status. */
  readonly cars = new Map<
    string,
    { -readonly [K in keyof FinanceVehicleFacts]: FinanceVehicleFacts[K] }
  >([
    [SWIFT, car(SWIFT, SHOWROOM_A, 'Maruti Swift · KA01AB1234', 'open', false)],
    [CRETA, car(CRETA, SHOWROOM_B, 'Hyundai Creta · KA05CD5678', 'open', false)],
    [DELETED_CAR, car(DELETED_CAR, SHOWROOM_A, 'Honda City · KA02EF0001', 'open', true)],
    [BALENO, car(BALENO, SHOWROOM_A, 'Maruti Baleno · KA03GH0002', 'open', false)],
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
      .filter((car) => car.status === 'sold' && !car.deleted)
      .filter((car) => (this.deals.rows.get(car.id)?.soldOn ?? null) === null)
      .map((car) => ({ ...car, soldLeadId: null }));
  }
}

/** Converts a booked lead the way the leads feature does: the car becomes sold. */
export class FakeFinanceLeadConversion implements IFinanceLeadConversion {
  readonly converted: { vehicleId: VehicleId; leadId: LeadId }[] = [];

  constructor(
    private readonly vehicles: FakeFinanceVehicleLookup,
    private readonly leads: FakeFinanceLeadLookup,
  ) {}

  async convertBookedLead(vehicleId: VehicleId, leadId: LeadId): Promise<void> {
    const booked = this.leads.booked.get(vehicleId) ?? [];
    if (!booked.includes(leadId)) {
      throw new BusinessRuleViolationError(
        'SALE_LEAD_NOT_BOOKED',
        'Lead is not booked for this car',
      );
    }
    const car = this.vehicles.cars.get(vehicleId);
    if (car !== undefined) car.status = 'sold';
    this.leads.booked.set(
      vehicleId,
      booked.filter((id) => id !== leadId),
    );
    this.converted.push({ vehicleId, leadId });
  }
}

/** Test shortcut: the car was sold through a lead converted from the CRM. */
export function markCarSold(kit: FinanceTestKit, vehicleId: VehicleId): void {
  const car = kit.vehicles.cars.get(vehicleId);
  if (car === undefined) throw new Error(`No fake car ${vehicleId}`);
  car.status = 'sold';
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

  async findSoldBetween(from: string, to: string): Promise<readonly SealedVehicleDeal[]> {
    return [...this.rows.values()].filter(
      (row) => row.soldOn !== null && row.soldOn >= from && row.soldOn <= to,
    );
  }

  async findWithData(): Promise<readonly SealedVehicleDeal[]> {
    return [...this.rows.values()].filter((row) => row.payload !== null || row.soldOn !== null);
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
  readonly leads: FakeFinanceLeadLookup;
  readonly leadConversion: FakeFinanceLeadConversion;
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
  const vehicles = new FakeFinanceVehicleLookup(deals);
  const leads = new FakeFinanceLeadLookup();
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
    vehicles,
    entrySealer: new EntrySealer(),
    tagSealer,
    tagSeeder: new DefaultTagSeeder(tags, tagSealer, clock, ids),
    deals,
    quotes: new InMemoryVehicleQuoteStore(),
    dealSealer: new VehicleDealSealer(),
    quoteSealer: new QuoteSealer(),
    leads,
    leadConversion: new FakeFinanceLeadConversion(vehicles, leads),
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

/** Deal terms with everything optional left empty. */
export function dealTerms(overrides: Partial<DealTerms> = {}): DealTerms {
  return {
    purchaseRate: null,
    commissionBasisPoints: null,
    purchasedOn: null,
    ownerExpectedPrice: null,
    minimumSellingPrice: null,
    note: null,
    ...overrides,
  };
}

/** A purchase car's money inputs; null rate = no terms recorded. */
export function bought(purchaseRate: Money | null): {
  readonly saleModel: SaleModel;
  readonly terms: DealTerms | null;
} {
  return {
    saleModel: 'purchase',
    terms: purchaseRate === null ? null : dealTerms({ purchaseRate }),
  };
}

/** A commission car's money inputs; null = no % recorded. */
export function onCommission(commissionBasisPoints: number | null): {
  readonly saleModel: SaleModel;
  readonly terms: DealTerms | null;
} {
  return {
    saleModel: 'commission',
    terms: commissionBasisPoints === null ? null : dealTerms({ commissionBasisPoints }),
  };
}
