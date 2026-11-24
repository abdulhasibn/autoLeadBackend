import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import type { CreateFinanceEntryCommand } from '../application/dtos/create-finance-entry-command';
import { FinanceLockedError } from '../application/errors/finance-locked.error';
import { FinanceReportData } from '../application/services/finance-report-data';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import { GetCashFlowUseCase } from '../application/use-cases/get-cash-flow.use-case';
import { GetDuesReportUseCase } from '../application/use-cases/get-dues-report.use-case';
import { GetFinanceSummaryUseCase } from '../application/use-cases/get-finance-summary.use-case';
import { GetProfitAndLossUseCase } from '../application/use-cases/get-profit-and-loss.use-case';
import { GetStockReportUseCase } from '../application/use-cases/get-stock-report.use-case';
import { GetVehicleProfitReportUseCase } from '../application/use-cases/get-vehicle-profit-report.use-case';
import { RecordVehicleSaleUseCase } from '../application/use-cases/record-vehicle-sale.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { MAX_LEDGER_ROWS } from '../domain/finance.constants';
import { Money } from '../domain/money.value-object';
import {
  ADMIN,
  BALENO,
  CRETA,
  DELETED_CAR,
  SALESPERSON,
  SHOWROOM_A,
  SHOWROOM_B,
  SWIFT,
  TEST_KDF,
  carBuyers,
  createFinanceTestKit,
  markCarSold,
  type FinanceTestKit,
  makeCreateEntry,
  makeSetDeal,
} from './fakes';

const ADMIN_IN_A = { ...ADMIN, showroomId: SHOWROOM_A };

describe('finance reports', () => {
  let kit: FinanceTestKit;
  let token: string;
  let pnl: GetProfitAndLossUseCase;
  let cashFlow: GetCashFlowUseCase;
  let vehicleProfit: GetVehicleProfitReportUseCase;
  let dues: GetDuesReportUseCase;
  let stock: GetStockReportUseCase;
  let summary: GetFinanceSummaryUseCase;

  beforeEach(async () => {
    // 2026-11-02 20:00 UTC is already 3 November in India.
    kit = createFinanceTestKit(new Date('2026-11-02T20:00:00.000Z'));
    const k = kit;
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
    pnl = new GetProfitAndLossUseCase(k.policy, k.sessionService, data);
    cashFlow = new GetCashFlowUseCase(k.policy, k.sessionService, data);
    vehicleProfit = new GetVehicleProfitReportUseCase(k.policy, k.sessionService, data);
    dues = new GetDuesReportUseCase(k.policy, k.sessionService, data);
    stock = new GetStockReportUseCase(k.policy, k.sessionService, data);
    summary = new GetFinanceSummaryUseCase(
      k.policy,
      k.sessionService,
      data,
      k.vehicles,
      k.clock,
      'Asia/Kolkata',
    );

    await seed();
  });

  async function seed(): Promise<void> {
    const k = kit;
    const create = makeCreateEntry(k);
    const setDeal = makeSetDeal(k);
    const recordSale = new RecordVehicleSaleUseCase(
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
    const entry = (c: Partial<CreateFinanceEntryCommand>) =>
      create.execute(
        {
          sessionToken: token,
          kind: 'expense',
          amountPaise: 100,
          entryDate: '2026-10-10',
          tagIds: [],
          vehicleId: null,
          purpose: null,
          party: null,
          note: null,
          showroomId: null,
          ...c,
        },
        ADMIN_IN_A,
      );
    const deal = (vehicleId: string, rupees: number) =>
      setDeal.execute(
        {
          sessionToken: token,
          vehicleId,
          purchaseRatePaise: rupees * 100,
          commissionBasisPoints: null,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      );

    // Swift (showroom A): the client's example, sold 25 October.
    await deal(SWIFT, 500000);
    await entry({
      vehicleId: SWIFT,
      amountPaise: 20_000_000,
      entryDate: '2026-09-20',
      purpose: 'purchase',
    });
    await entry({
      vehicleId: SWIFT,
      amountPaise: 30_000_000,
      entryDate: '2026-10-05',
      purpose: 'purchase',
    });
    await entry({ vehicleId: SWIFT, amountPaise: 4_500_000, entryDate: '2026-10-10' });
    markCarSold(kit, SWIFT);
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: 56_000_000,
        soldOn: '2026-10-25',
        leadId: null,
      },
      ADMIN,
    );
    await entry({
      vehicleId: SWIFT,
      kind: 'income',
      amountPaise: 5_000_000,
      entryDate: '2026-10-20',
    });
    await entry({
      vehicleId: SWIFT,
      kind: 'income',
      amountPaise: 51_000_000,
      entryDate: '2026-10-25',
    });
    await entry({ vehicleId: SWIFT, amountPaise: 200_000, entryDate: '2026-11-02' });

    // Creta (showroom B): bought, half paid, a repair; unsold.
    await deal(CRETA, 400000);
    await entry({
      vehicleId: CRETA,
      amountPaise: 20_000_000,
      entryDate: '2026-10-12',
      purpose: 'purchase',
    });
    await entry({ vehicleId: CRETA, amountPaise: 800_000, entryDate: '2026-10-15' });

    // Business (showroom A): rent each month.
    await entry({ amountPaise: 8_500_000, entryDate: '2026-10-01', note: 'Rent' });
    await entry({ amountPaise: 8_500_000, entryDate: '2026-11-01', note: 'Rent' });
  }

  const range = (period = 'month') => ({
    sessionToken: token,
    from: '2026-09-01',
    to: '2026-11-30',
    period,
    showroomId: null,
  });

  it('profit & loss: October holds the sale, November the late repair and rent', async () => {
    const report = await pnl.execute(range(), ADMIN);
    const [sep, oct, nov] = report.buckets;

    expect(sep).toMatchObject({ label: '2026-09', sales: 0, netProfit: 0 });
    expect(oct).toMatchObject({
      label: '2026-10',
      sales: 560000,
      costOfSales: 545000,
      grossProfit: 15000,
      businessExpenses: 85000,
      netProfit: -70000,
      carsSold: 1,
    });
    expect(nov).toMatchObject({ laterCarCosts: 2000, businessExpenses: 85000, netProfit: -87000 });
    expect(report.totals).toMatchObject({ sales: 560000, netProfit: -157000, carsSold: 1 });
    expect(report.truncated).toBe(false);
  });

  it('profit & loss filtered to a showroom', async () => {
    const b = await pnl.execute({ ...range(), showroomId: SHOWROOM_B }, ADMIN);

    expect(b.totals).toMatchObject({ sales: 0, businessExpenses: 0, netProfit: 0 });
  });

  it('cash flow counts payments by date', async () => {
    const report = await cashFlow.execute(range(), ADMIN);

    expect(report.totals).toMatchObject({
      inFromBuyers: 560000,
      outToSellers: 700000,
      outCarCosts: 55000,
      outBusiness: 170000,
      in: 560000,
      out: 925000,
      net: -365000,
    });
    expect(report.buckets.at(-1)?.cumulative).toBe(-365000);
  });

  it('profit per car sold in the range', async () => {
    const report = await vehicleProfit.execute(
      {
        sessionToken: token,
        from: '2026-10-01',
        to: '2026-10-31',
        showroomId: null,
        sort: 'profit',
      },
      ADMIN,
    );

    expect(report.items).toEqual([
      {
        vehicle: { id: SWIFT, label: 'Maruti Swift · KA01AB1234' },
        soldOn: '2026-10-25',
        saleModel: 'purchase',
        purchaseRate: 500000,
        commissionPercent: null,
        commission: null,
        costs: 47000,
        landingCost: 547000,
        finalisedPrice: 560000,
        profit: 13000,
      },
    ]);
    expect(report.totals).toEqual({
      cars: 1,
      sales: 560000,
      landingCost: 547000,
      commissions: 0,
      commissionSalesValue: 0,
      profit: 13000,
      carsMissingPurchaseRate: 0,
      uncountedSales: 0,
    });
  });

  it("'Sales' means purchased cars on every screen; a commission car's price is shown apart", async () => {
    const baleno = kit.vehicles.cars.get(BALENO);
    if (baleno !== undefined) baleno.saleModel = 'commission';
    await makeSetDeal(kit).execute(
      {
        sessionToken: token,
        vehicleId: BALENO,
        purchaseRatePaise: null,
        commissionBasisPoints: 500,
        purchasedOn: null,
        ownerExpectedPricePaise: null,
        minimumSellingPricePaise: null,
        note: null,
      },
      ADMIN,
    );
    markCarSold(kit, BALENO);
    await new RecordVehicleSaleUseCase(
      kit.policy,
      kit.sessionService,
      kit.vehicles,
      kit.leadConversion,
      kit.deals,
      kit.dealSealer,
      kit.entries,
      kit.entrySealer,
      kit.clock,
      kit.entries,
      kit.ids,
    ).execute(
      {
        sessionToken: token,
        vehicleId: BALENO,
        finalisedPricePaise: 30_000_000,
        soldOn: '2026-10-28',
        leadId: null,
      },
      ADMIN,
    );

    const oct = (await pnl.execute(range(), ADMIN)).buckets[1];
    const totals = (await pnl.execute(range(), ADMIN)).totals;
    expect(oct).toMatchObject({
      sales: 560000,
      commissions: 15000,
      commissionSalesValue: 300000,
      carsSold: 2,
    });

    const cars = await vehicleProfit.execute(
      {
        sessionToken: token,
        from: '2026-10-01',
        to: '2026-10-31',
        showroomId: null,
        sort: 'profit',
      },
      ADMIN,
    );
    expect(cars.totals).toMatchObject({
      cars: 2,
      sales: 560000,
      commissionSalesValue: 300000,
      commissions: 15000,
    });
    // The two reports agree on "Sales"; the owners' car is not in either.
    expect(totals.sales).toBe(cars.totals.sales);
    // Commission-car value is information only: profit is unchanged by it.
    expect(cars.totals.profit).toBe(13000 + 15000);
  });

  it('a car sold without a purchase rate stays out of sales and profit, and is flagged', async () => {
    markCarSold(kit, BALENO);
    await new RecordVehicleSaleUseCase(
      kit.policy,
      kit.sessionService,
      kit.vehicles,
      kit.leadConversion,
      kit.deals,
      kit.dealSealer,
      kit.entries,
      kit.entrySealer,
      kit.clock,
      kit.entries,
      kit.ids,
    ).execute(
      {
        sessionToken: token,
        vehicleId: BALENO,
        finalisedPricePaise: 30_000_000,
        soldOn: '2026-10-28',
        leadId: null,
      },
      ADMIN,
    );

    const oct = (await pnl.execute(range(), ADMIN)).buckets[1];
    expect(oct).toMatchObject({
      sales: 560000,
      grossProfit: 15000,
      netProfit: -70000,
      carsSold: 2,
      carsMissingPurchaseRate: 1,
      uncountedSales: 300000,
    });

    const cars = await vehicleProfit.execute(
      {
        sessionToken: token,
        from: '2026-10-01',
        to: '2026-10-31',
        showroomId: null,
        sort: 'profit',
      },
      ADMIN,
    );
    expect(cars.items.find((i) => i.vehicle.id === BALENO)).toMatchObject({
      purchaseRate: null,
      profit: null,
      finalisedPrice: 300000,
    });
    expect(cars.totals).toEqual({
      cars: 2,
      sales: 560000,
      landingCost: 547000,
      commissions: 0,
      commissionSalesValue: 0,
      profit: 13000,
      carsMissingPurchaseRate: 1,
      uncountedSales: 300000,
    });
  });

  it('dues: half the Creta is still owed to its seller', async () => {
    const report = await dues.execute({ sessionToken: token, showroomId: null }, ADMIN);

    expect(report.items).toEqual([
      expect.objectContaining({
        vehicle: { id: CRETA, label: 'Hyundai Creta · KA05CD5678' },
        owedToSeller: 200000,
        owedByBuyer: null,
      }),
    ]);
    expect(report.totals).toEqual({ owedToSellers: 200000, owedByBuyers: 0, owedBackToBuyers: 0 });
  });

  it('stock: the unsold Creta; dropped cars stay, sold and deleted cars do not', async () => {
    const creta = kit.vehicles.cars.get(CRETA);
    if (creta !== undefined) creta.status = 'dropped';
    const deleted = kit.vehicles.cars.get(DELETED_CAR);
    if (deleted !== undefined) deleted.deleted = true;

    const report = await stock.execute({ sessionToken: token, showroomId: null }, ADMIN);

    expect(report.items).toEqual([
      {
        vehicle: { id: CRETA, label: 'Hyundai Creta · KA05CD5678' },
        status: 'dropped',
        saleModel: 'purchase',
        purchaseRate: 400000,
        commissionPercent: null,
        costs: 8000,
        landingCost: 408000,
        paidToSeller: 200000,
        moneyInStock: 208000,
        currentQuote: null,
        listedPrice: null,
      },
    ]);
    expect(report.totals).toEqual({ cars: 1, moneyInStock: 208000 });
  });

  describe('stock is cash actually paid (BE-78)', () => {
    const entryFor = (vehicleId: string, rupees: number, purpose: 'purchase' | 'cost') =>
      makeCreateEntry(kit).execute(
        {
          sessionToken: token,
          kind: 'expense',
          amountPaise: rupees * 100,
          entryDate: '2026-10-20',
          purpose,
          tagIds: [],
          vehicleId,
          showroomId: null,
          party: null,
          note: null,
        },
        ADMIN_IN_A,
      );

    it('AC1: an agreed rate with nothing paid shows Rs 0 (car still listed)', async () => {
      // Baleno: rate 8,80,000, nothing paid.
      await makeSetDeal(kit).execute(
        {
          sessionToken: token,
          vehicleId: BALENO,
          purchaseRatePaise: 88_000_000,
          commissionBasisPoints: null,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      );
      const report = await stock.execute({ sessionToken: token, showroomId: null }, ADMIN);
      const row = report.items.find((i) => i.vehicle.id === BALENO);
      expect(row).toMatchObject({
        purchaseRate: 880000,
        landingCost: 880000,
        paidToSeller: 0,
        moneyInStock: 0,
      });
    });

    it('AC2/AC6/AC4: paid plus a cost; rate stays separate; report = summary = sum of rows', async () => {
      await makeSetDeal(kit).execute(
        {
          sessionToken: token,
          vehicleId: BALENO,
          purchaseRatePaise: 88_000_000,
          commissionBasisPoints: null,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      );
      await entryFor(BALENO, 300_000, 'purchase');
      await entryFor(BALENO, 20_000, 'cost');
      const report = await stock.execute({ sessionToken: token, showroomId: null }, ADMIN);
      const row = report.items.find((i) => i.vehicle.id === BALENO);
      expect(row).toMatchObject({ moneyInStock: 320000, purchaseRate: 880000 });
      const sum = report.items.reduce((t, i) => t + i.moneyInStock, 0);
      expect(report.totals.moneyInStock).toBe(sum);
      expect(report.totals.moneyInStock).toBe(208000 + 320000);
      const s = await summary.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(s.moneyInStock).toBe(report.totals.moneyInStock);
    });

    it('AC3: a commission car with an advance and no costs shows the advance', async () => {
      const baleno = kit.vehicles.cars.get(BALENO);
      if (baleno !== undefined) baleno.saleModel = 'commission';
      await makeSetDeal(kit).execute(
        {
          sessionToken: token,
          vehicleId: BALENO,
          purchaseRatePaise: null,
          commissionBasisPoints: 500,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      );
      await entryFor(BALENO, 50_000, 'purchase');
      const report = await stock.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(report.items.find((i) => i.vehicle.id === BALENO)).toMatchObject({
        saleModel: 'commission',
        paidToSeller: 50000,
        costs: 0,
        landingCost: 0,
        moneyInStock: 50000,
      });
      const s = await summary.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(s.moneyInStock).toBe(208000 + 50000);
    });

    it('AC5: a sold car is not listed, even a commission car with only an advance', async () => {
      const baleno = kit.vehicles.cars.get(BALENO);
      if (baleno !== undefined) baleno.saleModel = 'commission';
      await makeSetDeal(kit).execute(
        {
          sessionToken: token,
          vehicleId: BALENO,
          purchaseRatePaise: null,
          commissionBasisPoints: 500,
          purchasedOn: null,
          ownerExpectedPricePaise: null,
          minimumSellingPricePaise: null,
          note: null,
        },
        ADMIN,
      );
      await entryFor(BALENO, 50_000, 'purchase');
      markCarSold(kit, BALENO);
      const report = await stock.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(report.items.map((i) => i.vehicle.id)).not.toContain(SWIFT);
      expect(report.items.map((i) => i.vehicle.id)).not.toContain(BALENO);
    });
  });

  it('summary: month to date in India against the same span of October', async () => {
    const s = await summary.execute({ sessionToken: token, showroomId: null }, ADMIN);

    expect(s.thisMonth).toEqual({
      from: '2026-11-01',
      to: '2026-11-03',
      sales: 0,
      commissions: 0,
      commissionSalesValue: 0,
      netProfit: -87000,
      businessExpenses: 85000,
      cashIn: 0,
      cashOut: 87000,
      carsMissingPurchaseRate: 0,
      uncountedSales: 0,
    });
    expect(s.lastMonth).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-03',
      businessExpenses: 85000,
    });
    expect(s).toMatchObject({
      moneyInStock: 208000,
      owedToSellers: 200000,
      owedByBuyers: 0,
      awaitingSalePrice: 0,
    });
  });

  /** Seals `count` one-rupee business expenses on `date` straight into the ledger. */
  async function bulkExpenses(count: number, date: string): Promise<void> {
    const { cipher } = await kit.sessionService.open(ADMIN, token);
    for (let i = 0; i < count; i += 1) {
      const entry = FinanceEntry.create({
        id: toFinanceEntryId(kit.ids.generate()),
        kind: 'expense',
        amount: Money.ofPaise(100),
        entryDate: CalendarDate.create(date),
        purpose: null,
        tagIds: [],
        vehicleId: null,
        showroomId: SHOWROOM_A,
        party: null,
        note: null,
        recordedBy: ADMIN.userId,
        now: kit.clock.now(),
      });
      await kit.entries.save(kit.entrySealer.seal(entry, cipher));
    }
  }

  // Regression: reports used to read only the newest MAX_LEDGER_ROWS entries,
  // so the oldest ones (a car's purchase payments, last month's rent) fell out
  // of the totals once the ledger grew past the cap.
  describe(`with more than ${MAX_LEDGER_ROWS} entries`, () => {
    const BULK = MAX_LEDGER_ROWS + 1;

    beforeEach(async () => {
      kit.entries.scanPageSize = 700;
      // Newer than every seeded entry, so a newest-first cap drops the seed.
      await bulkExpenses(BULK, '2026-11-15');
    });

    it('stock, dues and summary still count the oldest entries', async () => {
      const stockReport = await stock.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(stockReport.items).toEqual([
        expect.objectContaining({
          vehicle: { id: CRETA, label: 'Hyundai Creta · KA05CD5678' },
          costs: 8000,
          landingCost: 408000,
          moneyInStock: 208000,
        }),
      ]);
      expect(stockReport.totals).toEqual({ cars: 1, moneyInStock: 208000 });
      expect(stockReport.truncated).toBe(false);

      const duesReport = await dues.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(duesReport.items).toEqual([
        expect.objectContaining({
          vehicle: { id: CRETA, label: 'Hyundai Creta · KA05CD5678' },
          owedToSeller: 200000,
        }),
      ]);
      expect(duesReport.totals).toEqual({
        owedToSellers: 200000,
        owedByBuyers: 0,
        owedBackToBuyers: 0,
      });
      expect(duesReport.truncated).toBe(false);

      const s = await summary.execute({ sessionToken: token, showroomId: null }, ADMIN);
      expect(s).toMatchObject({
        moneyInStock: 208000,
        owedToSellers: 200000,
        owedByBuyers: 0,
        truncated: false,
      });
    });

    it('a month-period P&L and cash flow still count every entry', async () => {
      const report = await pnl.execute(range(), ADMIN);
      const [, oct, nov] = report.buckets;

      expect(oct).toMatchObject({
        sales: 560000,
        costOfSales: 545000,
        businessExpenses: 85000,
        netProfit: -70000,
        carsSold: 1,
      });
      expect(nov).toMatchObject({
        laterCarCosts: 2000,
        businessExpenses: 85000 + BULK,
        netProfit: -87000 - BULK,
      });
      expect(report.totals).toMatchObject({
        businessExpenses: 170000 + BULK,
        netProfit: -157000 - BULK,
      });
      expect(report.truncated).toBe(false);

      const cash = await cashFlow.execute(range(), ADMIN);
      expect(cash.totals).toMatchObject({
        inFromBuyers: 560000,
        outToSellers: 700000,
        outCarCosts: 55000,
        outBusiness: 170000 + BULK,
      });
      expect(cash.truncated).toBe(false);
    });
  });

  it('validates ranges, needs a session and is admin-only', async () => {
    await expect(pnl.execute({ ...range('day') }, ADMIN)).resolves.toBeDefined();
    await expect(
      pnl.execute({ ...range('day'), from: '2025-01-01', to: '2026-06-01' }, ADMIN),
    ).rejects.toMatchObject({ code: 'DATE_RANGE_TOO_LONG' });
    await expect(pnl.execute({ ...range(), sessionToken: null }, ADMIN)).rejects.toBeInstanceOf(
      FinanceLockedError,
    );
    await expect(
      stock.execute({ sessionToken: token, showroomId: null }, SALESPERSON),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });
});
