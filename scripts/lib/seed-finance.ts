// Encrypted finance test data (ADR-0014/0015), built through the same code
// the API uses: NodeFinanceCrypto for the vault, the domain entities for the
// rules, the sealers for encryption and the infrastructure mappers for rows.
// Nothing here re-implements crypto.
//
// It draws from its own seeded random stream, so adding finance does not
// shift the rest of the seed data.

import { randomUUID } from 'node:crypto';

import { CalendarDate } from '../../src/domain/shared/calendar-date.value-object';
import { toLeadId } from '../../src/domain/shared/lead-id';
import { toShowroomId, type ShowroomId } from '../../src/domain/shared/showroom-id';
import { toUserId, type UserId } from '../../src/domain/shared/user-id';
import { toVehicleId, type VehicleId } from '../../src/domain/shared/vehicle-id';
import { EntrySealer } from '../../src/features/finance/application/services/entry.sealer';
import { QuoteSealer } from '../../src/features/finance/application/services/quote.sealer';
import { TagSealer } from '../../src/features/finance/application/services/tag.sealer';
import { VehicleDealSealer } from '../../src/features/finance/application/services/vehicle-deal.sealer';
import {
  FINANCE_WRAP_AAD,
  RECOVERY_WRAP_AAD,
} from '../../src/features/finance/application/services/vault-keyring';
import { DEFAULT_FINANCE_TAGS } from '../../src/features/finance/domain/default-finance-tags';
import type { EntryKindValue } from '../../src/features/finance/domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../../src/features/finance/domain/entry-purpose.value-object';
import { toFinanceEntryId } from '../../src/features/finance/domain/finance-entry-id';
import { FinanceEntry } from '../../src/features/finance/domain/finance-entry.entity';
import {
  toFinanceTagId,
  type FinanceTagId,
} from '../../src/features/finance/domain/finance-tag-id';
import { FinanceTag } from '../../src/features/finance/domain/finance-tag.entity';
import { toFinanceVaultId } from '../../src/features/finance/domain/finance-vault-id';
import { FinanceVault } from '../../src/features/finance/domain/finance-vault.entity';
import {
  CURRENT_KEY_VERSION,
  DEFAULT_KDF_PARAMS,
} from '../../src/features/finance/domain/finance.constants';
import { Money } from '../../src/features/finance/domain/money.value-object';
import { TagName } from '../../src/features/finance/domain/tag-name.value-object';
import { VehicleDeal } from '../../src/features/finance/domain/vehicle-deal.entity';
import { calculateVehicleMoney } from '../../src/features/finance/domain/vehicle-money';
import { toVehicleQuoteId } from '../../src/features/finance/domain/vehicle-quote-id';
import { VehicleQuote } from '../../src/features/finance/domain/vehicle-quote.entity';
import {
  FinanceKey,
  RecoveryKey,
} from '../../src/features/finance/domain/vault-secret.value-object';
import { toFinanceEntryRow } from '../../src/features/finance/infrastructure/finance-entry.mapper';
import { toFinanceTagRow } from '../../src/features/finance/infrastructure/finance-tag.mapper';
import { toFinanceVaultRow } from '../../src/features/finance/infrastructure/finance-vault.mapper';
import { NodeFinanceCrypto } from '../../src/features/finance/infrastructure/node-finance-crypto';
import { toVehicleDealRow } from '../../src/features/finance/infrastructure/vehicle-deal.mapper';
import { toVehicleQuoteRow } from '../../src/features/finance/infrastructure/vehicle-quote.mapper';
import type { TablesInsert } from '../../src/infrastructure/supabase/database.types';
import { createRandom, roundTo } from './random';

const DAY = 24 * 60 * 60 * 1000;
const IST = 5.5 * 60 * 60 * 1000;

/** A car from the simulation, as finance needs it. Money in rupees, times in ms. */
export interface FinanceSeedCar {
  readonly id: string;
  readonly registration: string;
  readonly createdAt: number;
  readonly listedPrice: number;
  readonly deleted: boolean;
  readonly soldAt: number | null;
  readonly soldLeadId: string | null;
  /** Leads that were linked to the car at some point (for quotes). */
  readonly leadIds: readonly string[];
}

export interface FinanceSeedInput {
  readonly cars: readonly FinanceSeedCar[];
  readonly adminId: string;
  readonly showroomId: string;
  readonly start: number;
  readonly now: number;
  /** Optional fixed finance key (test-only); otherwise one is generated. */
  readonly financeKey: string | undefined;
}

export interface FinanceSeedResult {
  readonly vault: TablesInsert<'finance_vault'>;
  readonly tags: TablesInsert<'finance_tags'>[];
  readonly entries: TablesInsert<'finance_entries'>[];
  /** Merged into the car's vehicle_financials row by the caller. */
  readonly deals: Map<
    string,
    Pick<TablesInsert<'vehicle_financials'>, 'payload' | 'key_version' | 'sold_on' | 'sold_by'>
  >;
  readonly quotes: TablesInsert<'vehicle_quotes'>[];
  readonly financeKey: string;
  readonly financeKeyGenerated: boolean;
  readonly recoveryKey: string;
  readonly clientCarRegistration: string | null;
  readonly summary: readonly string[];
}

/** Business tags beyond the client's defaults. */
const BUSINESS_TAGS = ['Rent', 'Salaries', 'Electricity', 'Marketing'] as const;

/** [tag, min rupees, max rupees] for car cost entries. */
const CAR_COSTS: readonly (readonly [string, number, number])[] = [
  ['Painting', 3_000, 15_000],
  ['Service', 2_000, 12_000],
  ['Rubbing polish', 1_500, 5_000],
  ['Insurance', 8_000, 25_000],
  ['Tyres', 6_000, 20_000],
  ['Mediator commission', 5_000, 15_000],
  ['Travel', 500, 3_000],
  ['Fuel', 500, 3_000],
  ['Food', 300, 1_500],
  ['Other', 1_000, 6_000],
];

export async function buildFinanceSeed(input: FinanceSeedInput): Promise<FinanceSeedResult> {
  const { rand, chance, pick, between, sample } = createRandom(20261105);
  const crypto = new NodeFinanceCrypto();
  const adminId: UserId = toUserId(input.adminId);
  const showroomId: ShowroomId = toShowroomId(input.showroomId);
  const dateOnly = (ms: number): string => new Date(ms + IST).toISOString().slice(0, 10);
  const clamp = (ms: number): number => Math.min(Math.max(ms, input.start), input.now);
  const at = (ms: number): Date => new Date(clamp(ms));

  // --- Vault: the same derivation and wrapping as SetupVaultUseCase.
  const financeKey =
    input.financeKey === undefined
      ? FinanceKey.fromBytes(crypto.randomBytes(FinanceKey.BYTE_LENGTH))
      : FinanceKey.create(input.financeKey);
  const recoveryKey = RecoveryKey.fromBytes(crypto.randomBytes(RecoveryKey.BYTE_LENGTH));
  const dataKey = crypto.newDataKey();
  const wrap = async (
    secret: string,
    aad: string,
  ): Promise<{ salt: string; wrappedKey: string }> => {
    const salt = crypto.newSalt();
    const kek = await crypto.deriveKek(secret, salt, DEFAULT_KDF_PARAMS);
    const wrappedKey = crypto.wrapKey(kek, dataKey, aad);
    kek.fill(0);
    return { salt, wrappedKey };
  };
  const vaultEntity = FinanceVault.createPending({
    id: toFinanceVaultId(randomUUID()),
    kdf: DEFAULT_KDF_PARAMS,
    financeWrap: await wrap(financeKey.value, FINANCE_WRAP_AAD),
    recoveryWrap: await wrap(recoveryKey.value, RECOVERY_WRAP_AAD),
    keyVersion: CURRENT_KEY_VERSION,
    createdBy: adminId,
    now: at(input.start),
  });
  vaultEntity.confirm(at(input.start));
  const cipher = crypto.cipherFor(dataKey, CURRENT_KEY_VERSION);

  const tagSealer = new TagSealer();
  const entrySealer = new EntrySealer();
  const dealSealer = new VehicleDealSealer();
  const quoteSealer = new QuoteSealer();

  // --- Tags.
  const tagIds = new Map<string, FinanceTagId>();
  const tagEntities: FinanceTag[] = [];
  for (const name of [...DEFAULT_FINANCE_TAGS, ...BUSINESS_TAGS]) {
    const tag = FinanceTag.create({
      id: toFinanceTagId(randomUUID()),
      name: TagName.create(name),
      color: null,
      now: at(input.start),
    });
    tagIds.set(name, tag.id);
    tagEntities.push(tag);
  }
  const tag = (name: string): FinanceTagId => {
    const id = tagIds.get(name);
    if (id === undefined) throw new Error(`Unknown seed tag ${name}`);
    return id;
  };

  // --- Entries, deals, quotes.
  const entries: FinanceEntry[] = [];
  const deals: VehicleDeal[] = [];
  const quotes: VehicleQuote[] = [];
  const entry = (e: {
    kind: EntryKindValue;
    rupees: number;
    at: number;
    purpose: EntryPurposeValue | null;
    tags?: string[];
    car?: VehicleId;
    party?: string | null;
    note?: string | null;
    deleted?: boolean;
  }): void => {
    const when = clamp(e.at);
    const created = FinanceEntry.create({
      id: toFinanceEntryId(randomUUID()),
      kind: e.kind,
      amount: Money.fromRupees(e.rupees),
      entryDate: CalendarDate.create(dateOnly(when)),
      purpose: e.purpose,
      tagIds: (e.tags ?? []).map(tag),
      vehicleId: e.car ?? null,
      showroomId,
      party: e.party ?? null,
      note: e.note ?? null,
      recordedBy: adminId,
      now: new Date(when),
    });
    if (e.deleted === true) created.softDelete(new Date(when + 60_000));
    entries.push(created);
  };

  const live = input.cars.filter((car) => !car.deleted && car.listedPrice > 0);
  const clientCar = live.find((car) => car.soldAt !== null && car.soldLeadId !== null) ?? null;
  let awaitingPrice = 0;

  for (const car of live) {
    const vehicleId = toVehicleId(car.id);
    const deal = VehicleDeal.empty(vehicleId, Money.fromRupees(car.listedPrice), at(car.createdAt));
    const soldAt = car.soldAt;

    if (car === clientCar && soldAt !== null) {
      // The client's worked example (finance-module §2.1), exactly.
      const bought = car.createdAt;
      deal.setTerms(
        {
          purchaseRate: Money.fromRupees(500_000),
          purchasedOn: CalendarDate.create(dateOnly(bought)),
          ownerExpectedPrice: Money.fromRupees(520_000),
          minimumSellingPrice: null,
          note: "Client's worked example",
        },
        at(bought),
      );
      const step = Math.max((soldAt - bought) / 10, 60 * 60 * 1000);
      entry({
        kind: 'expense',
        rupees: 200_000,
        at: bought,
        purpose: 'purchase',
        tags: ['Purchase'],
        car: vehicleId,
        party: 'Seller',
      });
      entry({
        kind: 'expense',
        rupees: 300_000,
        at: bought + step,
        purpose: 'purchase',
        tags: ['Purchase'],
        car: vehicleId,
        party: 'Seller',
      });
      entry({
        kind: 'expense',
        rupees: 10_000,
        at: bought + step,
        purpose: 'cost',
        tags: ['Mediator commission'],
        car: vehicleId,
      });
      entry({
        kind: 'expense',
        rupees: 5_000,
        at: bought + 2 * step,
        purpose: 'cost',
        tags: ['Painting'],
        car: vehicleId,
      });
      entry({
        kind: 'expense',
        rupees: 5_000,
        at: bought + 3 * step,
        purpose: 'cost',
        tags: ['Service'],
        car: vehicleId,
      });
      entry({
        kind: 'expense',
        rupees: 5_000,
        at: bought + 4 * step,
        purpose: 'cost',
        tags: ['Rubbing polish'],
        car: vehicleId,
      });
      entry({
        kind: 'expense',
        rupees: 15_000,
        at: bought + 5 * step,
        purpose: 'cost',
        tags: ['Insurance', 'Tyres'],
        car: vehicleId,
      });
      entry({
        kind: 'expense',
        rupees: 5_000,
        at: bought + 6 * step,
        purpose: 'cost',
        tags: ['Travel', 'Fuel'],
        car: vehicleId,
      });
      quotes.push(quote(vehicleId, car.soldLeadId, 585_000, bought + 7 * step, 'Buyer'));
      entry({
        kind: 'income',
        rupees: 50_000,
        at: bought + 8 * step,
        purpose: 'sale',
        car: vehicleId,
        note: 'Token',
      });
      entry({
        kind: 'income',
        rupees: 510_000,
        at: soldAt,
        purpose: 'sale',
        car: vehicleId,
        note: 'Balance',
      });
      deal.recordSale(
        Money.fromRupees(560_000),
        CalendarDate.create(dateOnly(soldAt)),
        adminId,
        at(soldAt),
      );
      deals.push(deal);
      continue;
    }

    // Purchase: agreed rate, paid in one or two instalments; some still owed.
    const rate = roundTo(car.listedPrice * (0.8 + rand() * 0.1), 5_000);
    deal.setTerms(
      {
        purchaseRate: Money.fromRupees(rate),
        purchasedOn: CalendarDate.create(dateOnly(car.createdAt)),
        ownerExpectedPrice: chance(0.6) ? Money.fromRupees(roundTo(rate * 1.05, 5_000)) : null,
        minimumSellingPrice: chance(0.4)
          ? Money.fromRupees(roundTo(car.listedPrice * 0.92, 5_000))
          : null,
        note: null,
      },
      at(car.createdAt),
    );
    const owesSeller = chance(0.15);
    if (chance(0.5) || owesSeller) {
      const first = roundTo(rate * (0.3 + rand() * 0.4), 5_000);
      entry({
        kind: 'expense',
        rupees: first,
        at: car.createdAt,
        purpose: 'purchase',
        tags: ['Purchase'],
        car: vehicleId,
        party: 'Seller',
      });
      if (!owesSeller) {
        entry({
          kind: 'expense',
          rupees: rate - first,
          at: car.createdAt + between(2, 15) * DAY,
          purpose: 'purchase',
          tags: ['Purchase'],
          car: vehicleId,
          party: 'Seller',
        });
      }
    } else {
      entry({
        kind: 'expense',
        rupees: rate,
        at: car.createdAt,
        purpose: 'purchase',
        tags: ['Purchase'],
        car: vehicleId,
        party: 'Seller',
      });
    }

    // Costs after intake, before the sale when there is one.
    const lastCostAt = soldAt === null ? input.now : soldAt - DAY;
    for (const [name, min, max] of sample(CAR_COSTS, between(1, 4))) {
      const when = car.createdAt + rand() * Math.max(lastCostAt - car.createdAt, DAY);
      entry({
        kind: 'expense',
        rupees: roundTo(between(min, max), 100),
        at: when,
        purpose: 'cost',
        tags: [name],
        car: vehicleId,
      });
    }

    // Quotes to people who were interested.
    for (const leadId of sample(car.leadIds, between(0, Math.min(3, car.leadIds.length)))) {
      const until = soldAt ?? input.now;
      const when = car.createdAt + rand() * Math.max(until - car.createdAt, DAY);
      quotes.push(
        quote(
          vehicleId,
          leadId,
          roundTo(car.listedPrice * (0.97 + rand() * 0.06), 5_000),
          when,
          null,
        ),
      );
    }

    // Sale: most sold cars have their price recorded; a few are still awaiting it.
    if (soldAt !== null) {
      if (chance(0.05)) {
        awaitingPrice += 1;
      } else {
        const finalised = roundTo(car.listedPrice * (0.93 + rand() * 0.07), 5_000);
        const token = roundTo(finalised * (0.05 + rand() * 0.1), 5_000);
        const balanceDue = chance(0.1);
        entry({
          kind: 'income',
          rupees: token,
          at: soldAt - between(1, 7) * DAY,
          purpose: 'sale',
          car: vehicleId,
          note: 'Token',
        });
        const balance = balanceDue ? roundTo((finalised - token) * 0.7, 5_000) : finalised - token;
        entry({
          kind: 'income',
          rupees: balance,
          at: soldAt,
          purpose: 'sale',
          car: vehicleId,
          note: 'Balance',
        });
        deal.recordSale(
          Money.fromRupees(finalised),
          CalendarDate.create(dateOnly(soldAt)),
          adminId,
          at(soldAt),
        );
        if (chance(0.1) && soldAt + 2 * DAY < input.now) {
          entry({
            kind: 'expense',
            rupees: roundTo(between(1_000, 8_000), 100),
            at: soldAt + between(2, 10) * DAY,
            purpose: 'cost',
            tags: ['Service'],
            car: vehicleId,
            note: 'Promised fix after delivery',
          });
        }
      }
    }
    deals.push(deal);
  }

  // --- Business: monthly running costs and the odd receipt.
  for (let month = new Date(input.start); month.getTime() <= input.now;) {
    const first = Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 4, 30);
    const monthly: [string, number, number, string][] = [
      ['Rent', 85_000, 1, 'Showroom rent'],
      ['Electricity', roundTo(between(9_000, 16_000), 100), 6, 'Electricity bill'],
      [
        'Marketing',
        roundTo(between(15_000, 45_000), 500),
        10,
        pick(['Instagram ads', 'OLX listings', 'Newspaper classifieds']),
      ],
      ['Salaries', 150_000, 28, 'Staff salaries'],
    ];
    for (const [name, rupees, day, note] of monthly) {
      const when = first + (day - 1) * DAY;
      if (when >= input.start && when <= input.now) {
        entry({ kind: 'expense', rupees, at: when, purpose: null, tags: [name], note });
      }
    }
    const other = first + between(5, 25) * DAY;
    if (chance(0.6) && other >= input.start && other <= input.now) {
      entry({
        kind: 'income',
        rupees: roundTo(between(3_000, 20_000), 100),
        at: other,
        purpose: null,
        tags: ['Other'],
        note: pick(['RC transfer service fee', 'Accessories sale', 'Detailing service']),
      });
    }
    month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  }
  // Two mistakes that were deleted.
  entry({
    kind: 'expense',
    rupees: 85_000,
    at: input.start + 40 * DAY,
    purpose: null,
    tags: ['Rent'],
    note: 'Duplicate',
    deleted: true,
  });
  entry({
    kind: 'expense',
    rupees: 2_500,
    at: input.start + 90 * DAY,
    purpose: null,
    tags: ['Fuel'],
    note: 'Wrong amount',
    deleted: true,
  });

  function quote(
    vehicleId: VehicleId,
    leadId: string | null,
    rupees: number,
    when: number,
    quotedTo: string | null,
  ): VehicleQuote {
    return VehicleQuote.create({
      id: toVehicleQuoteId(randomUUID()),
      vehicleId,
      leadId: leadId === null ? null : toLeadId(leadId),
      quotedOn: CalendarDate.create(dateOnly(clamp(when))),
      amount: Money.fromRupees(rupees),
      quotedTo,
      note: null,
      createdBy: adminId,
      createdAt: at(when),
    });
  }

  // --- Seal everything with the real sealers.
  const sealedTags = tagEntities.map((t) => tagSealer.seal(t, cipher));
  const sealedEntries = entries.map((e) => entrySealer.seal(e, cipher));
  const sealedDeals = deals.map((d) => dealSealer.seal(d, cipher));
  const sealedQuotes = quotes.map((q) => quoteSealer.seal(q, cipher));

  // --- Self-check: everything opens again, and the client car adds up.
  const opened = sealedEntries.map((row) => entrySealer.open(row, cipher));
  sealedTags.forEach((row) => tagSealer.open(row, cipher));
  sealedQuotes.forEach((row) => quoteSealer.open(row, cipher));
  const openedDeals = new Map(
    sealedDeals.map((row) => [row.vehicleId as string, dealSealer.open(row, cipher)]),
  );
  if (clientCar !== null) {
    const clientDeal = openedDeals.get(clientCar.id);
    const money = calculateVehicleMoney({
      purchaseRate: clientDeal?.terms?.purchaseRate ?? null,
      finalisedPrice: clientDeal?.sale?.finalisedPrice ?? null,
      entries: opened.filter((e) => e.vehicleId === clientCar.id && !e.isDeleted),
    });
    if (money.landingCost !== 54_500_000 || money.profit !== 1_500_000) {
      throw new Error(
        `Finance seed self-check failed: client car landing ${money.landingCost / 100}, profit ${(money.profit ?? 0) / 100}`,
      );
    }
  }

  // --- Summary.
  const liveEntries = opened.filter((e) => !e.isDeleted);
  const count = (pred: (e: FinanceEntry) => boolean): number => liveEntries.filter(pred).length;
  const byPurpose = ['purchase', 'cost', 'sale', 'other', 'general']
    .map((p) => `${p}=${count((e) => e.purpose === p)}`)
    .join(' ');
  let owedToSellers = 0;
  let owedByBuyers = 0;
  let stockValue = 0;
  for (const car of live) {
    const deal = openedDeals.get(car.id);
    const money = calculateVehicleMoney({
      purchaseRate: deal?.terms?.purchaseRate ?? null,
      finalisedPrice: deal?.sale?.finalisedPrice ?? null,
      entries: liveEntries.filter((e) => e.vehicleId === car.id),
    });
    if ((money.owedToSeller ?? 0) > 0) owedToSellers += 1;
    if ((money.owedByBuyer ?? 0) > 0) owedByBuyers += 1;
    if (car.soldAt === null) stockValue += money.landingCost;
  }

  return {
    vault: toFinanceVaultRow(vaultEntity),
    tags: sealedTags.map(toFinanceTagRow),
    entries: sealedEntries.map(toFinanceEntryRow),
    deals: new Map(
      sealedDeals.map((row) => {
        const { payload, key_version, sold_on, sold_by } = toVehicleDealRow(row);
        return [row.vehicleId as string, { payload, key_version, sold_on, sold_by }];
      }),
    ),
    quotes: sealedQuotes.map(toVehicleQuoteRow),
    financeKey: financeKey.value,
    financeKeyGenerated: input.financeKey === undefined,
    recoveryKey: recoveryKey.value,
    clientCarRegistration: clientCar?.registration ?? null,
    summary: [
      `finance: tags=${sealedTags.length} entries=${liveEntries.length} (+${opened.length - liveEntries.length} deleted) deals=${sealedDeals.length} quotes=${sealedQuotes.length}`,
      `finance entries: income=${count((e) => e.kind === 'income')} expense=${count((e) => e.kind === 'expense')} ${byPurpose}`,
      `finance cars: owe seller=${owedToSellers} buyer owes=${owedByBuyers} sold awaiting price=${awaitingPrice} stock value=₹${(stockValue / 100).toLocaleString('en-IN')}`,
      `finance client example car: ${clientCar?.registration ?? 'none (no sold car)'} — landing ₹5,45,000, profit ₹15,000 (self-check passed)`,
    ],
  };
}
