import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { CreateFinanceEntryCommand } from '../application/dtos/create-finance-entry-command';
import { FinanceLockedError } from '../application/errors/finance-locked.error';
import { FinanceReportData } from '../application/services/finance-report-data';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import { CreateFinanceEntryUseCase } from '../application/use-cases/create-finance-entry.use-case';
import { GetCashFlowUseCase } from '../application/use-cases/get-cash-flow.use-case';
import { GetDuesReportUseCase } from '../application/use-cases/get-dues-report.use-case';
import { GetFinanceSummaryUseCase } from '../application/use-cases/get-finance-summary.use-case';
import { GetProfitAndLossUseCase } from '../application/use-cases/get-profit-and-loss.use-case';
import { GetStockReportUseCase } from '../application/use-cases/get-stock-report.use-case';
import { GetVehicleProfitReportUseCase } from '../application/use-cases/get-vehicle-profit-report.use-case';
import { RecordVehicleSaleUseCase } from '../application/use-cases/record-vehicle-sale.use-case';
import { SetVehicleDealUseCase } from '../application/use-cases/set-vehicle-deal.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import {
  ADMIN,
  CRETA,
  DELETED_CAR,
  SALESPERSON,
  SHOWROOM_A,
  SHOWROOM_B,
  SWIFT,
  TEST_KDF,
  createFinanceTestKit,
  type FinanceTestKit,
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
    const create = new CreateFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
      k.clock,
      k.ids,
    );
    const setDeal = new SetVehicleDealUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.deals,
      k.dealSealer,
      k.clock,
    );
    const recordSale = new RecordVehicleSaleUseCase(
      k.policy,
      k.sessionService,
      k.vehicles,
      k.deals,
      k.dealSealer,
      k.clock,
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
    await recordSale.execute(
      {
        sessionToken: token,
        vehicleId: SWIFT,
        finalisedPricePaise: 56_000_000,
        soldOn: '2026-10-25',
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
        purchaseRate: 500000,
        costs: 47000,
        landingCost: 547000,
        finalisedPrice: 560000,
        profit: 13000,
      },
    ]);
    expect(report.totals).toEqual({ cars: 1, sales: 560000, landingCost: 547000, profit: 13000 });
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
    expect(report.totals).toEqual({ owedToSellers: 200000, owedByBuyers: 0 });
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
        purchaseRate: 400000,
        costs: 8000,
        landingCost: 408000,
        currentQuote: null,
        listedPrice: null,
      },
    ]);
    expect(report.totals).toEqual({ cars: 1, moneyInStock: 408000 });
  });

  it('summary: month to date in India against the same span of October', async () => {
    const s = await summary.execute({ sessionToken: token, showroomId: null }, ADMIN);

    expect(s.thisMonth).toEqual({
      from: '2026-11-01',
      to: '2026-11-03',
      sales: 0,
      netProfit: -87000,
      businessExpenses: 85000,
      cashIn: 0,
      cashOut: 87000,
    });
    expect(s.lastMonth).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-03',
      businessExpenses: 85000,
    });
    expect(s).toMatchObject({
      moneyInStock: 408000,
      owedToSellers: 200000,
      owedByBuyers: 0,
      awaitingSalePrice: 0,
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
