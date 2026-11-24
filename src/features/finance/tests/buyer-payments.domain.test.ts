import { describe, expect, it } from 'vitest';

import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toUserId } from '../../../domain/shared/user-id';
import { EntrySealer } from '../application/services/entry.sealer';
import { buildCashFlow } from '../domain/build-cash-flow';
import { buildProfitAndLoss } from '../domain/build-profit-and-loss';
import { EntryPurpose } from '../domain/entry-purpose.value-object';
import type { EntryKindValue } from '../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../domain/entry-purpose.value-object';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { Money } from '../domain/money.value-object';
import { ReportPeriod } from '../domain/report-period.value-object';
import { currentBuyersOf, VehicleMoneyTally } from '../domain/vehicle-money';
import { NodeFinanceCrypto } from '../infrastructure/node-finance-crypto';
import {
  createFinanceEntryBodySchema,
  listFinanceEntriesQuerySchema,
  updateFinanceEntryBodySchema,
} from '../presentation/schemas/finance-entry.schemas';
import { bought, CRETA, SHOWROOM_A, SWIFT } from './fakes';

const A = toLeadId('eeeeeeee-0000-4000-8000-000000000001');
const B = toLeadId('eeeeeeee-0000-4000-8000-0000000000b2');
const NOW = new Date('2026-11-02T10:00:00.000Z');
const crypto = new NodeFinanceCrypto();
const cipher = crypto.cipherFor(crypto.newDataKey(), 1);

let seq = 100;
function entry(
  kind: EntryKindValue,
  purpose: EntryPurposeValue,
  rupees: number,
  leadId: typeof A | null = null,
  date = '2026-10-10',
): FinanceEntry {
  seq += 1;
  return FinanceEntry.create({
    id: toFinanceEntryId(`11111111-1111-4111-8111-${String(seq).padStart(12, '0')}`),
    kind,
    amount: Money.fromRupees(rupees),
    entryDate: CalendarDate.create(date),
    purpose,
    tagIds: [],
    vehicleId: SWIFT,
    leadId,
    showroomId: SHOWROOM_A,
    party: null,
    note: null,
    recordedBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    now: NOW,
  });
}

describe('refund purpose', () => {
  it('is allowed on a car-linked expense only', () => {
    expect(EntryPurpose.of('expense', true, 'refund').value).toBe('refund');
    expect(() => EntryPurpose.of('income', true, 'refund')).toThrow();
    expect(() => EntryPurpose.of('expense', false, 'refund')).toThrow();
  });
});

describe('FinanceEntry lead', () => {
  const t = new Date('2026-11-03T10:00:00.000Z');

  it('is kept on sale and refund, and dropped on other purposes', () => {
    expect(entry('income', 'sale', 1, A).leadId).toBe(A);
    expect(entry('expense', 'refund', 1, A).leadId).toBe(A);
    expect(entry('income', 'other', 1, A).leadId).toBeNull();
    expect(entry('expense', 'cost', 1, A).leadId).toBeNull();
  });

  it('is cleared by a purpose change, unlink, or a move to another car', () => {
    const changed = entry('income', 'sale', 1, A);
    changed.changePurpose('other', t);
    expect(changed.leadId).toBeNull();

    const unlinked = entry('income', 'sale', 1, A);
    unlinked.unlink(SHOWROOM_A, t);
    expect(unlinked.leadId).toBeNull();

    const moved = entry('income', 'sale', 1, A);
    moved.linkToVehicle(CRETA, SHOWROOM_A, null, t);
    expect(moved.leadId).toBeNull();
  });

  it('stays on the same car, and on a move when the request sends a lead', () => {
    const same = entry('income', 'sale', 1, A);
    same.linkToVehicle(SWIFT, SHOWROOM_A, null, t);
    expect(same.leadId).toBe(A);

    const moved = entry('income', 'sale', 1, A);
    moved.linkToVehicle(CRETA, SHOWROOM_A, null, t, B);
    expect(moved).toMatchObject({ leadId: B, purpose: 'sale', vehicleId: CRETA });
  });
});

describe('EntrySealer leadId', () => {
  const sealer = new EntrySealer();

  it('round-trips the lead', () => {
    const opened = sealer.open(sealer.seal(entry('income', 'sale', 5, A), cipher), cipher);

    expect(opened.leadId).toBe(A);
  });

  it('reads older entries with no leadId key', () => {
    const sealed = sealer.seal(entry('income', 'sale', 5), cipher);
    const json = cipher.open(sealed.payload, `finance_entries:${sealed.id}`);
    expect(JSON.parse(json)).not.toHaveProperty('leadId');

    expect(sealer.open(sealed, cipher).leadId).toBeNull();
  });

  it('keeps the lead out of the plaintext columns', () => {
    const sealed = sealer.seal(entry('income', 'sale', 5, A), cipher);
    const { payload: _payload, ...columns } = sealed;

    expect(JSON.stringify(columns)).not.toContain(A);
  });

  it('rejects a leadId that is not a string, and ignores one on other purposes', () => {
    const sealed = sealer.seal(entry('income', 'other', 5), cipher);
    const at = (extra: Record<string, unknown>) => ({
      ...sealed,
      payload: cipher.seal(
        JSON.stringify({
          amount: 500,
          purpose: 'other',
          tagIds: [],
          party: null,
          note: null,
          ...extra,
        }),
        `finance_entries:${sealed.id}`,
      ),
    });

    expect(() => sealer.open(at({ leadId: 7 }), cipher)).toThrow(DataIntegrityError);
    expect(sealer.open(at({ leadId: A }), cipher).leadId).toBeNull();
  });

  it('stores the car the lead was validated against, and reads the lead only on that car', () => {
    const sealed = sealer.seal(entry('income', 'sale', 5, A), cipher);
    const raw = JSON.parse(cipher.open(sealed.payload, `finance_entries:${sealed.id}`));
    expect(raw).toMatchObject({ leadId: A, leadCarId: SWIFT });

    // An older build moved the entry (vehicle_id changed) and carried both keys along.
    const moved = { ...sealed, vehicleId: CRETA };
    expect(sealer.open(moved, cipher).leadId).toBeNull();
    expect(sealer.open(sealed, cipher).leadId).toBe(A);
  });

  it('still carries unknown keys through a save', () => {
    const sealed = sealer.seal(entry('income', 'sale', 5, A), cipher);
    const raw = JSON.parse(cipher.open(sealed.payload, `finance_entries:${sealed.id}`));
    const withFuture = {
      ...sealed,
      payload: cipher.seal(
        JSON.stringify({ ...raw, futureKey: 1 }),
        `finance_entries:${sealed.id}`,
      ),
    };

    const again = sealer.seal(sealer.open(withFuture, cipher), cipher);

    expect(JSON.parse(cipher.open(again.payload, `finance_entries:${sealed.id}`))).toMatchObject({
      leadId: A,
      leadCarId: SWIFT,
      futureKey: 1,
    });
  });
});

describe('VehicleMoneyTally buyers', () => {
  const finish = (tally: VehicleMoneyTally, buyers: ReturnType<typeof currentBuyersOf>) =>
    tally.finish({ ...bought(null), finalisedPrice: null, buyers });

  it('splits paid and refunded per lead; former buyers owe back, current ones count', () => {
    const tally = new VehicleMoneyTally();
    [
      entry('income', 'sale', 50_000, A),
      entry('income', 'sale', 70_000, B),
      entry('expense', 'refund', 20_000, B),
    ].forEach((e) => tally.add(e));

    const money = finish(tally, currentBuyersOf({ status: 'linked', soldLeadId: null }, [B]));

    expect(money.receivedFromBuyer).toBe(5_000_000);
    expect(money.buyers).toEqual([
      { leadId: B, paid: 7_000_000, refunded: 2_000_000, net: 5_000_000 },
    ]);
    expect(money.refundsOwed).toEqual([
      { leadId: A, paid: 5_000_000, refunded: 0, owed: 5_000_000 },
    ]);
  });

  it('shows a negative owed when refunded more than paid', () => {
    const tally = new VehicleMoneyTally();
    tally.add(entry('income', 'sale', 100, A));
    tally.add(entry('expense', 'refund', 150, A));

    const money = finish(tally, currentBuyersOf({ status: 'open', soldLeadId: null }, []));

    expect(money.refundsOwed).toMatchObject([{ leadId: A, owed: -5_000 }]);
  });

  it("counts a sold car's loose entries as the sold lead's, and a sold car without one as current", () => {
    const tally = new VehicleMoneyTally();
    tally.add(entry('income', 'sale', 100));
    tally.add(entry('income', 'sale', 40, B));

    const sold = finish(tally, currentBuyersOf({ status: 'sold', soldLeadId: A }, []));
    expect(sold.buyers).toMatchObject([{ leadId: A, net: 10_000 }]);
    expect(sold.refundsOwed).toMatchObject([{ leadId: B, owed: 4_000 }]);

    const noLead = finish(tally, currentBuyersOf({ status: 'sold', soldLeadId: null }, []));
    expect(noLead.receivedFromBuyer).toBe(10_000);
    expect(noLead.refundsOwed).toMatchObject([{ leadId: B }]);
  });
});

describe('reports ignore or bucket refunds', () => {
  const buckets = ReportPeriod.create('month').bucketsBetween(
    CalendarDate.create('2026-10-01'),
    CalendarDate.create('2026-10-31'),
  );

  it('cash flow puts a refund in outRefundsToBuyers, not business expenses', () => {
    const flow = buildCashFlow({
      buckets,
      entries: [entry('income', 'sale', 50_000, A), entry('expense', 'refund', 50_000, A)],
    });

    expect(flow.totals).toMatchObject({
      inFromBuyers: 5_000_000,
      outRefundsToBuyers: 5_000_000,
      outBusiness: 0,
      out: 5_000_000,
      net: 0,
    });
  });

  it('P&L does not count a car-linked refund anywhere', () => {
    const pnl = buildProfitAndLoss({
      buckets,
      soldCars: [],
      entries: [entry('expense', 'refund', 50_000, A)],
      sales: new Map(),
    });

    expect(pnl.totals).toMatchObject({ businessExpenses: 0, otherIncome: 0, netProfit: 0 });
  });
});

describe('request schemas', () => {
  const body = { kind: 'income', amount: 100, entryDate: '2026-10-10' };

  it('accepts leadId and the refund purpose on create', () => {
    const parsed = createFinanceEntryBodySchema.parse({
      ...body,
      kind: 'expense',
      purpose: 'refund',
      vehicleId: SWIFT,
      leadId: A,
    });

    expect(parsed).toMatchObject({ purpose: 'refund', leadId: A });
    expect(createFinanceEntryBodySchema.parse(body).leadId).toBeNull();
    expect(() => createFinanceEntryBodySchema.parse({ ...body, leadId: 'x' })).toThrow();
  });

  it('counts leadId as a change on PATCH, and keepLead alone is not', () => {
    expect(updateFinanceEntryBodySchema.parse({ leadId: A })).toEqual({ leadId: A });
    expect(updateFinanceEntryBodySchema.parse({ leadId: null })).toEqual({ leadId: null });
    expect(() => updateFinanceEntryBodySchema.parse({ keepLead: true })).toThrow();
  });

  it('allows the leadId filter only with vehicleId', () => {
    expect(() =>
      listFinanceEntriesQuerySchema.parse({ leadId: A, from: '2026-10-01', to: '2026-10-02' }),
    ).toThrow();
    expect(listFinanceEntriesQuerySchema.parse({ leadId: A, vehicleId: SWIFT }).leadId).toBe(A);
  });
});
