import { beforeEach, describe, expect, it } from 'vitest';

import { toLeadId } from '../../../domain/shared/lead-id';
import type { CreateFinanceEntryCommand } from '../application/dtos/create-finance-entry-command';
import { FinanceReportData } from '../application/services/finance-report-data';
import { ClearVehicleSaleUseCase } from '../application/use-cases/clear-vehicle-sale.use-case';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import { DeleteFinanceEntryUseCase } from '../application/use-cases/delete-finance-entry.use-case';
import { GetDuesReportUseCase } from '../application/use-cases/get-dues-report.use-case';
import { GetFinanceEntryUseCase } from '../application/use-cases/get-finance-entry.use-case';
import { GetFinanceSummaryUseCase } from '../application/use-cases/get-finance-summary.use-case';
import { GetVehicleFinanceUseCase } from '../application/use-cases/get-vehicle-finance.use-case';
import { ListFinanceEntriesUseCase } from '../application/use-cases/list-finance-entries.use-case';
import { ListVehicleFinanceSummariesUseCase } from '../application/use-cases/list-vehicle-finance-summaries.use-case';
import { RecordVehicleSaleUseCase } from '../application/use-cases/record-vehicle-sale.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import type { UpdateFinanceEntryUseCase } from '../application/use-cases/update-finance-entry.use-case';
import type { CreateFinanceEntryUseCase } from '../application/use-cases/create-finance-entry.use-case';
import type { SetVehicleDealUseCase } from '../application/use-cases/set-vehicle-deal.use-case';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { Money } from '../domain/money.value-object';
import {
  ADMIN,
  CRETA,
  LEAD_ANIL,
  SHOWROOM_A,
  SWIFT,
  TEST_KDF,
  carBuyers,
  createFinanceTestKit,
  makeCreateEntry,
  makeSetDeal,
  makeUpdateEntry,
  type FinanceTestKit,
} from './fakes';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';

const A = LEAD_ANIL;
const B = toLeadId('eeeeeeee-0000-4000-8000-0000000000b2');
const C = toLeadId('eeeeeeee-0000-4000-8000-0000000000c3');
const rs = (n: number): number => n * 100;

describe('buyer payments belong to the lead who paid them (BE-77)', () => {
  let k: FinanceTestKit;
  let token: string;
  let create: CreateFinanceEntryUseCase;
  let update: UpdateFinanceEntryUseCase;
  let setDeal: SetVehicleDealUseCase;
  let money: GetVehicleFinanceUseCase;
  let recordSale: RecordVehicleSaleUseCase;
  let clearSale: ClearVehicleSaleUseCase;
  let dues: GetDuesReportUseCase;
  let summary: GetFinanceSummaryUseCase;
  let summaries: ListVehicleFinanceSummariesUseCase;
  let deleteEntry: DeleteFinanceEntryUseCase;
  let getEntry: GetFinanceEntryUseCase;
  let listEntries: ListFinanceEntriesUseCase;

  beforeEach(async () => {
    k = createFinanceTestKit(new Date('2026-11-02T10:00:00.000Z'));
    const keys = await new SetupVaultUseCase(
      k.policy,
      k.vaults,
      k.keyring,
      k.crypto,
      k.audit,
      k.clock,
      k.ids,
      TEST_KDF,
    ).execute(ADMIN);
    await new ConfirmVaultUseCase(k.policy, k.vaults, k.keyring, k.audit, k.clock).execute(
      { recoveryKey: keys.recoveryKey },
      ADMIN,
    );
    token = (
      await new UnlockVaultUseCase(
        k.policy,
        k.vaults,
        k.keyring,
        k.sessionService,
        k.audit,
        k.clock,
        k.tagSeeder,
      ).execute({ financeKey: keys.financeKey }, ADMIN)
    ).sessionToken;

    create = makeCreateEntry(k);
    update = makeUpdateEntry(k);
    setDeal = makeSetDeal(k);
    money = new GetVehicleFinanceUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.deals,
      k.entries,
      k.quotes,
      k.leads,
      k.tags,
      k.dealSealer,
      k.entrySealer,
      k.quoteSealer,
      k.tagSealer,
      k.clock,
      carBuyers(k),
    );
    recordSale = new RecordVehicleSaleUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.leadConversion,
      k.deals,
      k.dealSealer,
      k.entries,
      k.entrySealer,
      k.clock,
      k.entries,
      k.ids,
    );
    clearSale = new ClearVehicleSaleUseCase(
      k.policy,
      k.sessionService,
      k.deals,
      k.dealSealer,
      k.clock,
      k.vehicles,
      k.entries,
      k.entries,
      k.entrySealer,
    );
    const data = new FinanceReportData(
      k.deals,
      k.entries,
      k.quotes,
      k.vehicles,
      k.dealSealer,
      k.entrySealer,
      k.quoteSealer,
      carBuyers(k),
    );
    dues = new GetDuesReportUseCase(k.policy, k.sessionService, data);
    summary = new GetFinanceSummaryUseCase(
      k.policy,
      k.sessionService,
      data,
      k.vehicles,
      k.clock,
      'Asia/Kolkata',
    );
    summaries = new ListVehicleFinanceSummariesUseCase(
      k.policy,
      k.sessionService,
      k.deals,
      k.entries,
      k.quotes,
      k.vehicles,
      k.dealSealer,
      k.entrySealer,
      k.quoteSealer,
      k.clock,
      carBuyers(k),
    );
    deleteEntry = new DeleteFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.entrySealer,
      k.clock,
    );
    getEntry = new GetFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
      k.leads,
    );
    listEntries = new ListFinanceEntriesUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
      k.leads,
    );

    k.leads.addLead(A, 'Anil Kumar', SWIFT, true);
    await setDeal.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        purchaseRatePaise: rs(400_000),
        commissionBasisPoints: null,
        purchasedOn: '2026-10-01',
        ownerExpectedPricePaise: null,
        minimumSellingPricePaise: null,
        note: null,
      },
      ADMIN,
    );
  });

  function payment(overrides: Partial<CreateFinanceEntryCommand>) {
    return create.execute(
      {
        sessionToken: token,
        kind: 'income',
        amountPaise: rs(50_000),
        entryDate: '2026-10-10',
        tagIds: [],
        vehicleId: SWIFT,
        purpose: 'sale',
        party: null,
        note: null,
        showroomId: null,
        ...overrides,
      },
      ADMIN,
    );
  }

  const refund = (overrides: Partial<CreateFinanceEntryCommand>) =>
    payment({ kind: 'expense', purpose: 'refund', entryDate: '2026-10-12', ...overrides });

  const carMoney = (vehicleId: string = SWIFT) =>
    money.execute({ sessionToken: token, vehicleId }, ADMIN);
  const report = () => dues.execute({ sessionToken: token, showroomId: null }, ADMIN);

  /** A is booked and has paid a ₹50,000 token, then is marked Lost. */
  async function aPaidThenLost(): Promise<void> {
    await payment({ leadId: A });
    k.leads.booked.set(SWIFT, []);
  }

  function bBooks(): void {
    k.leads.addLead(B, 'Bala', SWIFT, true);
  }

  function sell(leadId: string, price: number, paid?: number, extra = {}) {
    return recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: rs(price),
        soldOn: '2026-10-20',
        leadId,
        ...(paid === undefined
          ? {}
          : { buyerPayment: { amountPaise: rs(paid), paidOn: '2026-10-20' } }),
        ...extra,
      },
      ADMIN,
    );
  }

  describe('AC1: a buyer who backs out is owed their money back', () => {
    it('shows it as a refund owed, not as received, and lists it in Dues', async () => {
      await aPaidThenLost();

      const m = await carMoney();
      expect(m.receivedFromBuyer).toBe(0);
      expect(m.buyers).toEqual([]);
      expect(m.refundsOwed).toEqual([
        {
          lead: { id: A, name: 'Anil Kumar', phone: null },
          paid: 50_000,
          refunded: 0,
          owed: 50_000,
        },
      ]);
      const d = await report();
      expect(d.items.every((i) => i.owedByBuyer === null)).toBe(true);
      expect(d.refundsOwed).toMatchObject([
        { vehicle: { id: SWIFT }, lead: { id: A }, paid: 50_000, owed: 50_000 },
      ]);
      expect(d.totals.owedBackToBuyers).toBe(50_000);
      expect(
        (await summary.execute({ sessionToken: token, showroomId: null }, ADMIN)).owedBackToBuyers,
      ).toBe(50_000);
    });

    it('shows the current buyer a row of their own while booked', async () => {
      await payment({ leadId: A });

      const m = await carMoney();

      expect(m.buyers).toMatchObject([{ lead: { id: A }, paid: 50_000, refunded: 0, net: 50_000 }]);
      expect(m.receivedFromBuyer).toBe(50_000);
      expect(m.refundsOwed).toEqual([]);
    });

    it('lists a refund owed even for a car that has no deal at all', async () => {
      await k.entries.save(
        k.entrySealer.seal(
          FinanceEntry.create({
            id: toFinanceEntryId('11111111-1111-4111-8111-000000000099'),
            kind: 'income',
            amount: Money.fromRupees(1000),
            entryDate: CalendarDate.create('2026-10-10'),
            purpose: 'sale',
            tagIds: [],
            vehicleId: CRETA,
            leadId: B,
            showroomId: SHOWROOM_A,
            party: null,
            note: null,
            recordedBy: ADMIN.userId,
            now: k.clock.now(),
          }),
          (await k.sessionService.open(ADMIN, token)).cipher,
        ),
      );
      k.leads.addLead(B, 'Bala', CRETA);

      expect((await report()).refundsOwed).toMatchObject([{ vehicle: { id: CRETA }, owed: 1000 }]);
    });
  });

  it('AC2: the next buyer pays in full and the lost buyer is still owed', async () => {
    await aPaidThenLost();
    bBooks();

    const state = await sell(B, 600_000, 600_000);

    expect(state.sale?.finalisedPrice).toBe(600_000);
    const m = await carMoney();
    expect(m.owedByBuyer).toBe(0);
    expect(m.receivedFromBuyer).toBe(600_000);
    expect(m.buyers).toMatchObject([{ lead: { id: B }, paid: 600_000, net: 600_000 }]);
    expect(m.refundsOwed).toMatchObject([{ lead: { id: A }, owed: 50_000 }]);
    const list = await listEntries.execute(
      { sessionToken: token, vehicleId: SWIFT, leadId: B, sort: 'date', limit: 50, offset: 0 },
      ADMIN,
    );
    expect(list.items).toMatchObject([{ amount: 600_000, lead: { id: B } }]);
  });

  describe('AC3: the sale check only counts the sale lead', () => {
    it("accepts a sale to A even though B's token is on the car", async () => {
      bBooks();
      await payment({ leadId: B, amountPaise: rs(100_000) });

      await sell(A, 500_000, 450_000);

      const m = await carMoney();
      expect(m.owedByBuyer).toBe(50_000);
      expect(m.refundsOwed).toMatchObject([{ lead: { id: B }, owed: 100_000 }]);
      expect(m.buyers).toMatchObject([{ lead: { id: A }, net: 450_000 }]);
    });

    it("refuses a price below the sale lead's own payments, with their figure", async () => {
      bBooks();
      await payment({ leadId: A, amountPaise: rs(300_000) });

      await expect(sell(A, 200_000, 50_000)).rejects.toMatchObject({
        code: 'SALE_PRICE_BELOW_RECEIVED',
        details: { receivedFromBuyer: 350_000, finalisedPrice: 200_000 },
      });
    });

    it('lets a refund bring the sale lead back under the price', async () => {
      await payment({ leadId: A, amountPaise: rs(300_000) });
      await refund({ leadId: A, amountPaise: rs(150_000) });

      await expect(sell(A, 200_000)).resolves.toBeDefined();
    });
  });

  describe('AC4-5: refunds', () => {
    it('a full refund clears the amount owed and leaves Dues empty', async () => {
      await aPaidThenLost();

      const saved = await refund({ leadId: A, amountPaise: rs(50_000) });

      expect(saved).toMatchObject({ purpose: 'refund', kind: 'expense', lead: { id: A } });
      expect((await carMoney()).refundsOwed).toEqual([]);
      const d = await report();
      expect(d.refundsOwed).toEqual([]);
      expect(d.totals.owedBackToBuyers).toBe(0);
    });

    it('refuses more than the buyer paid, with the figures', async () => {
      await aPaidThenLost();

      await expect(refund({ leadId: A, amountPaise: rs(60_000) })).rejects.toMatchObject({
        code: 'REFUND_ABOVE_PAID',
        details: { paid: 50_000, refunded: 0, requested: 60_000, refundable: 50_000 },
      });
    });

    it('picks the only lead with something to get back when none is sent', async () => {
      await aPaidThenLost();

      expect(await refund({ amountPaise: rs(10_000) })).toMatchObject({ lead: { id: A } });
    });

    it('asks which lead when two have paid, and when nobody has', async () => {
      bBooks();
      await payment({ leadId: A });
      await payment({ leadId: B });
      await expect(refund({ amountPaise: rs(100) })).rejects.toMatchObject({
        code: 'REFUND_LEAD_REQUIRED',
      });
      await expect(refund({ vehicleId: CRETA, amountPaise: rs(100) })).rejects.toMatchObject({
        code: 'REFUND_LEAD_REQUIRED',
      });
    });

    it('refuses a refund to a lead who has paid nothing', async () => {
      await payment({ leadId: A });

      await expect(refund({ leadId: B, amountPaise: rs(1) })).rejects.toMatchObject({
        code: 'REFUND_ABOVE_PAID',
      });
    });

    it('leaves the entry being edited out when it is changed', async () => {
      await aPaidThenLost();
      const r = await refund({ leadId: A, amountPaise: rs(50_000) });

      const edited = await update.execute(
        { sessionToken: token, entryId: r.id, amountPaise: rs(40_000) },
        ADMIN,
      );
      expect(edited.amount).toBe(40_000);
      await expect(
        update.execute({ sessionToken: token, entryId: r.id, amountPaise: rs(50_001) }, ADMIN),
      ).rejects.toMatchObject({ code: 'REFUND_ABOVE_PAID' });
    });

    it('settles an overpayment by the current buyer', async () => {
      await payment({ leadId: A, amountPaise: rs(300_000) });
      await sell(A, 250_000, undefined, { keepOverpayment: true });
      expect((await carMoney()).owedByBuyer).toBe(-50_000);

      await refund({ leadId: A, amountPaise: rs(50_000) });

      expect((await carMoney()).owedByBuyer).toBe(0);
    });
  });

  describe('AC6-7: choosing the lead', () => {
    it('asks which lead paid when several have booked', async () => {
      bBooks();

      await expect(payment({})).rejects.toMatchObject({
        code: 'SALE_LEAD_REQUIRED',
        details: { bookedLeadIds: [A, B] },
      });
    });

    it('uses the only booked lead when none is sent', async () => {
      expect(await payment({})).toMatchObject({ lead: { id: A } });
    });

    it('refuses a lead who has not booked the car', async () => {
      await expect(payment({ leadId: C })).rejects.toMatchObject({
        code: 'SALE_LEAD_NOT_ON_CAR',
        details: { leadId: C },
      });
    });

    it('keeps SALE_NOT_RECORDED when nobody has booked', async () => {
      k.leads.booked.set(SWIFT, []);

      await expect(payment({})).rejects.toMatchObject({ code: 'SALE_NOT_RECORDED' });
    });

    it('does not store a lead on other income', async () => {
      const saved = await payment({ purpose: 'other', leadId: A });

      expect(saved.lead).toBeNull();
    });

    it("edits a Lost lead's token without re-checking the lead", async () => {
      const saved = await payment({ leadId: A });
      k.leads.booked.set(SWIFT, []);

      const edited = await update.execute(
        { sessionToken: token, entryId: saved.id, amountPaise: rs(45_000), note: 'fixed' },
        ADMIN,
      );

      expect(edited).toMatchObject({ amount: 45_000, lead: { id: A } });
    });
  });

  describe('moving the lead and the money', () => {
    it('assigns a payment to any existing lead, deleted ones too (lead-only PATCH)', async () => {
      const saved = await payment({ leadId: A });
      k.leads.leads.set(C, { id: C, name: 'Gone', phone: null, deleted: true, vehicleId: null });

      const moved = await update.execute(
        { sessionToken: token, entryId: saved.id, leadId: C },
        ADMIN,
      );

      expect(moved.lead).toEqual({ id: C, name: 'Gone' });
    });

    it('refuses an unknown lead on a lead-only PATCH', async () => {
      const saved = await payment({ leadId: A });

      await expect(
        update.execute(
          {
            sessionToken: token,
            entryId: saved.id,
            leadId: 'eeeeeeee-0000-4000-8000-0000000000ff',
          },
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'SALE_LEAD_NOT_ON_CAR' });
    });

    it('drops the lead when the purpose changes away from sale', async () => {
      const saved = await payment({ leadId: A });

      const changed = await update.execute(
        { sessionToken: token, entryId: saved.id, purpose: 'other' },
        ADMIN,
      );

      expect(changed.lead).toBeNull();
    });

    it('re-resolves the lead on the new car, or keeps it when asked (§4.3)', async () => {
      const resolved = await payment({ leadId: A });
      const kept = await payment({ leadId: A });
      k.leads.addLead(B, 'Bala', CRETA, true); // the buyer booked on CRETA

      const moved = await update.execute(
        { sessionToken: token, entryId: resolved.id, vehicleId: CRETA },
        ADMIN,
      );
      expect(moved.lead?.id).toBe(B);

      // A's lead is not on CRETA, so keeping A is refused ...
      await expect(
        update.execute(
          { sessionToken: token, entryId: kept.id, vehicleId: CRETA, keepLead: true },
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'SALE_LEAD_NOT_ON_CAR' });
      // ... until their lead is on that car.
      k.leads.addLead(A, 'Anil Kumar', CRETA);
      const ok = await update.execute(
        { sessionToken: token, entryId: kept.id, vehicleId: CRETA, keepLead: true },
        ADMIN,
      );
      expect(ok).toMatchObject({ purpose: 'sale', lead: { id: A } });
    });

    it("accepts a revived lead's token on the car their lead is on now", async () => {
      const saved = await payment({ leadId: A });
      k.leads.addLead(B, 'Bala', CRETA); // on the car, not booked yet

      const moved = await update.execute(
        { sessionToken: token, entryId: saved.id, vehicleId: CRETA, leadId: B },
        ADMIN,
      );

      expect(moved.lead?.id).toBe(B);
    });
  });

  describe('AC8: removing a sale', () => {
    it("deletes only the sold lead's payments with withBuyerPayments", async () => {
      await aPaidThenLost();
      bBooks();
      await sell(B, 600_000, 100_000);
      await payment({ leadId: B, amountPaise: rs(20_000) });

      await clearSale.execute(
        { sessionToken: token, vehicleId: SWIFT, withBuyerPayments: true },
        ADMIN,
      );

      const m = await carMoney();
      expect(m.sale).toBeNull();
      expect(m.buyers).toMatchObject([{ lead: { id: B }, paid: 0 }]);
      expect(m.refundsOwed).toMatchObject([{ lead: { id: A }, owed: 50_000 }]);
    });

    it('keeps every payment, and the sold lead as buyer, without it', async () => {
      bBooks();
      await sell(B, 600_000, 100_000);

      await clearSale.execute({ sessionToken: token, vehicleId: SWIFT }, ADMIN);

      const m = await carMoney();
      expect(m.sale).toBeNull();
      expect(m.vehicle.status).toBe('sold');
      expect(m.buyers).toMatchObject([{ lead: { id: B }, net: 100_000 }]);
    });

    it("also takes the car's unassigned payments on a sold car", async () => {
      bBooks();
      await sell(B, 600_000);
      await saveLegacy(rs(30_000));

      await clearSale.execute(
        { sessionToken: token, vehicleId: SWIFT, withBuyerPayments: true },
        ADMIN,
      );

      expect((await carMoney()).receivedFromBuyer).toBe(0);
    });
  });

  describe('buyerPayments: "adjust"', () => {
    it("trims the sale lead's payments to fit, newest first, and leaves others alone", async () => {
      bBooks();
      await payment({ leadId: A, amountPaise: rs(70_000), entryDate: '2026-10-01' });
      await payment({ leadId: A, amountPaise: rs(40_000), entryDate: '2026-10-05' });
      await payment({ leadId: B, amountPaise: rs(90_000) });

      await sell(A, 100_000, 10_000, { buyerPayments: 'adjust' });

      const m = await carMoney();
      expect(m.buyers).toMatchObject([{ lead: { id: A }, paid: 100_000 }]);
      expect(m.owedByBuyer).toBe(0);
      expect(m.refundsOwed).toMatchObject([{ lead: { id: B }, owed: 90_000 }]);
    });

    it('puts the trimmed payments back when the sale then fails', async () => {
      await payment({ leadId: A, amountPaise: rs(70_000) });
      k.leadConversion.convertBookedLead = () => Promise.reject(new Error('conversion down'));

      await expect(sell(A, 50_000, undefined, { buyerPayments: 'adjust' })).rejects.toThrow(
        'conversion down',
      );

      expect((await carMoney()).receivedFromBuyer).toBe(70_000);
    });
  });

  describe('AC9: older entries with no lead', () => {
    it('are unassigned on an open car, then assigned to a lead', async () => {
      await saveLegacy(rs(50_000));
      k.leads.booked.set(SWIFT, []);

      const m = await carMoney();
      expect(m.receivedFromBuyer).toBe(0);
      expect(m.refundsOwed).toEqual([{ lead: null, paid: 50_000, refunded: 0, owed: 50_000 }]);
      expect((await report()).refundsOwed).toMatchObject([{ lead: null, owed: 50_000 }]);

      const id = [...k.entries.rows.keys()][0] ?? '';
      await update.execute({ sessionToken: token, entryId: id, leadId: A }, ADMIN);

      expect((await carMoney()).refundsOwed).toMatchObject([{ lead: { id: A }, owed: 50_000 }]);
    });

    it("count as the sold lead's on a sold car, so its numbers don't change", async () => {
      bBooks();
      await sell(B, 600_000);
      await saveLegacy(rs(100_000));

      const m = await carMoney();

      expect(m.receivedFromBuyer).toBe(100_000);
      expect(m.owedByBuyer).toBe(500_000);
      expect(m.buyers).toMatchObject([{ lead: { id: B }, net: 100_000 }]);
      expect(m.refundsOwed).toEqual([]);
    });

    it('cannot be refunded until assigned', async () => {
      await saveLegacy(rs(50_000));

      await expect(refund({ leadId: A, amountPaise: rs(1) })).rejects.toMatchObject({
        code: 'REFUND_ABOVE_PAID',
      });
    });
  });

  it('AC10: car list summaries, summary and car money agree', async () => {
    await aPaidThenLost();
    bBooks();
    await sell(B, 600_000, 200_000);

    const m = await carMoney();
    const [row] = await summaries.execute({ sessionToken: token, vehicleIds: [SWIFT] }, ADMIN);
    const d = await report();

    expect(row?.owedByBuyer).toBe(m.owedByBuyer);
    expect(d.items[0]?.owedByBuyer).toBe(m.owedByBuyer);
    expect(d.items[0]?.receivedFromBuyer).toBe(m.receivedFromBuyer);
    expect(d.totals.owedByBuyers).toBe(400_000);
  });

  it('AC11: a former buyer booked again on the same car counts as current again', async () => {
    await aPaidThenLost();
    expect((await carMoney()).refundsOwed).toHaveLength(1);

    k.leads.booked.set(SWIFT, [A]);

    const m = await carMoney();
    expect(m.refundsOwed).toEqual([]);
    expect(m.receivedFromBuyer).toBe(50_000);
  });

  describe('a lead who is no longer on the car', () => {
    it('shows a lead moved to another car as a refund owed on the old car (§4.10)', async () => {
      await payment({ leadId: A });
      k.leads.booked.set(SWIFT, []);
      k.leads.addLead(A, 'Anil Kumar', CRETA); // A's lead now sits on another car

      const m = await carMoney();

      expect(m.receivedFromBuyer).toBe(0);
      expect(m.refundsOwed).toMatchObject([{ lead: { id: A }, owed: 50_000 }]);
    });

    it('reads an entry moved by an older build (leadCarId differs from its car) as unassigned', async () => {
      const saved = await payment({ leadId: A });
      k.leads.booked.set(SWIFT, []);
      const row = k.entries.rows.get(saved.id);
      if (row === undefined) throw new Error('entry not stored');
      const { cipher } = await k.sessionService.open(ADMIN, token);
      const stored = JSON.parse(cipher.open(row.payload, `finance_entries:${row.id}`));
      expect(stored.leadCarId).toBe(SWIFT);
      // The older build moved the entry to SWIFT from CRETA, keeping the unknown keys.
      k.entries.rows.set(row.id, {
        ...row,
        payload: cipher.seal(
          JSON.stringify({ ...stored, leadCarId: CRETA }),
          `finance_entries:${row.id}`,
        ),
      });

      const m = await carMoney();

      expect(m.refundsOwed).toEqual([{ lead: null, paid: 50_000, refunded: 0, owed: 50_000 }]);
      expect(m.receivedFromBuyer).toBe(0);
    });
  });

  it('shows the lead on get, list and create responses', async () => {
    const saved = await payment({ leadId: A });

    expect(saved.lead).toEqual({ id: A, name: 'Anil Kumar' });
    expect(
      (await getEntry.execute({ sessionToken: token, entryId: saved.id }, ADMIN)).lead,
    ).toEqual({ id: A, name: 'Anil Kumar' });
    const list = await listEntries.execute(
      { sessionToken: token, vehicleId: SWIFT, sort: 'date', limit: 10, offset: 0 },
      ADMIN,
    );
    expect(list.items[0]?.lead?.id).toBe(A);
    await deleteEntry.execute({ sessionToken: token, entryId: saved.id }, ADMIN);
    expect((await carMoney()).receivedFromBuyer).toBe(0);
  });

  /** An entry written before BE-77: a `sale` with no lead. */
  async function saveLegacy(paise: number): Promise<void> {
    const { cipher } = await k.sessionService.open(ADMIN, token);
    const entry = FinanceEntry.create({
      id: toFinanceEntryId(k.ids.generate()),
      kind: 'income',
      amount: Money.ofPaise(paise),
      entryDate: CalendarDate.create('2026-10-09'),
      purpose: 'sale',
      tagIds: [],
      vehicleId: SWIFT,
      showroomId: SHOWROOM_A,
      party: null,
      note: null,
      recordedBy: ADMIN.userId,
      now: k.clock.now(),
    });
    await k.entries.save(k.entrySealer.seal(entry, cipher));
  }
});
