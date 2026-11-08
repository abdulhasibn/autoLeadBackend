import { describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import { buildCashFlow } from '../domain/build-cash-flow';
import { buildProfitAndLoss, type SoldCar } from '../domain/build-profit-and-loss';
import type { EntryKindValue } from '../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../domain/entry-purpose.value-object';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import { FinanceEntry } from '../domain/finance-entry.entity';
import { Money } from '../domain/money.value-object';
import { ReportPeriod } from '../domain/report-period.value-object';
import { calculateVehicleMoney } from '../domain/vehicle-money';
import { CRETA, SHOWROOM_A, SWIFT } from './fakes';

const d = (value: string): CalendarDate => CalendarDate.create(value);

let seq = 0;
function e(
  kind: EntryKindValue,
  rupees: number,
  date: string,
  purpose: EntryPurposeValue | null,
  vehicleId: VehicleId | null,
): FinanceEntry {
  seq += 1;
  return FinanceEntry.create({
    id: toFinanceEntryId(`11111111-1111-4111-8111-${String(seq).padStart(12, '0')}`),
    kind,
    amount: Money.fromRupees(rupees),
    entryDate: d(date),
    purpose,
    tagIds: [],
    vehicleId,
    showroomId: SHOWROOM_A,
    party: null,
    note: null,
    recordedBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    now: new Date('2026-11-02T10:00:00.000Z'),
  });
}

/** The client's car: bought in September, worked on, sold 25 October, one fix in November. */
function clientCar(): { entries: FinanceEntry[]; sold: SoldCar } {
  const entries = [
    e('expense', 200000, '2026-09-20', 'purchase', SWIFT),
    e('expense', 300000, '2026-10-05', 'purchase', SWIFT),
    e('expense', 10000, '2026-09-20', 'cost', SWIFT),
    e('expense', 35000, '2026-10-10', 'cost', SWIFT),
    e('income', 50000, '2026-10-20', 'sale', SWIFT),
    e('income', 510000, '2026-10-25', 'sale', SWIFT),
    e('expense', 2000, '2026-11-04', 'cost', SWIFT),
  ];
  return {
    entries,
    sold: {
      vehicleId: SWIFT,
      soldOn: '2026-10-25',
      finalisedPrice: Money.fromRupees(560000),
      purchaseRate: Money.fromRupees(500000),
      entries,
    },
  };
}

/** An unsold car with costs, rent, and other income. */
function otherEntries(): FinanceEntry[] {
  return [
    e('expense', 400000, '2026-10-12', 'purchase', CRETA),
    e('expense', 8000, '2026-10-15', 'cost', CRETA),
    e('expense', 85000, '2026-10-01', null, null),
    e('expense', 85000, '2026-11-01', null, null),
    e('income', 3000, '2026-11-10', null, null),
    e('income', 1500, '2026-10-26', 'other', SWIFT),
  ];
}

const rupees = (paise: number): number => paise / 100;

describe('ReportPeriod', () => {
  it('buckets by day, ISO week, month and year, clipping to the range', () => {
    const from = d('2026-09-29');
    const to = d('2026-11-03');

    expect(ReportPeriod.create('month').bucketsBetween(from, to)).toEqual([
      { start: '2026-09-29', end: '2026-09-30', label: '2026-09' },
      { start: '2026-10-01', end: '2026-10-31', label: '2026-10' },
      { start: '2026-11-01', end: '2026-11-03', label: '2026-11' },
    ]);
    expect(ReportPeriod.create('week').bucketsBetween(d('2026-12-30'), d('2027-01-05'))).toEqual([
      { start: '2026-12-30', end: '2027-01-03', label: '2026-12-28' },
      { start: '2027-01-04', end: '2027-01-05', label: '2027-01-04' },
    ]);
    expect(ReportPeriod.create('year').bucketsBetween(from, to)).toHaveLength(1);
    expect(
      ReportPeriod.create('day').bucketsBetween(d('2028-02-28'), d('2028-03-01')),
    ).toHaveLength(3);
  });

  it('limits ranges by period', () => {
    expect(() => ReportPeriod.create('day').assertRange(d('2025-01-01'), d('2026-01-02'))).toThrow(
      BusinessRuleViolationError,
    );
    expect(() =>
      ReportPeriod.create('month').assertRange(d('2022-01-01'), d('2026-12-31')),
    ).not.toThrow();
    expect(() =>
      ReportPeriod.create('month').assertRange(d('2026-02-01'), d('2026-01-01')),
    ).toThrow(BusinessRuleViolationError);
    expect(() => ReportPeriod.create('quarter')).toThrow();
  });
});

describe('buildProfitAndLoss', () => {
  const month = ReportPeriod.create('month');
  const buckets = month.bucketsBetween(d('2026-09-01'), d('2026-11-30'));

  function report() {
    const car = clientCar();
    const entries = [...car.entries, ...otherEntries()];
    return buildProfitAndLoss({
      buckets,
      soldCars: [car.sold],
      entries,
      sales: new Map([[SWIFT as string, { soldOn: '2026-10-25', hasPurchaseRate: true }]]),
    });
  }

  it('puts the sale, purchase rate and pre-sale costs in the sale month', () => {
    const [sep, oct] = report().buckets;

    expect(sep).toMatchObject({ sales: 0, costOfSales: 0, businessExpenses: 0, netProfit: 0 });
    expect(rupees(oct?.sales ?? 0)).toBe(560000);
    expect(rupees(oct?.costOfSales ?? 0)).toBe(545000);
    expect(rupees(oct?.grossProfit ?? 0)).toBe(15000);
    expect(oct?.carsSold).toBe(1);
  });

  it('puts later car costs, rent and other income on their own dates; ignores payments and stock', () => {
    const [, oct, nov] = report().buckets;

    expect(rupees(oct?.businessExpenses ?? 0)).toBe(85000);
    expect(rupees(oct?.otherIncome ?? 0)).toBe(1500);
    expect(rupees(oct?.netProfit ?? 0)).toBe(15000 + 1500 - 85000);
    expect(rupees(nov?.laterCarCosts ?? 0)).toBe(2000);
    expect(rupees(nov?.otherIncome ?? 0)).toBe(3000);
    expect(rupees(nov?.netProfit ?? 0)).toBe(-2000 + 3000 - 85000);
  });

  it('leaves a sold car without a purchase rate out of sales and profit, and its later costs', () => {
    const car = clientCar();
    const pnl = buildProfitAndLoss({
      buckets,
      soldCars: [{ ...car.sold, purchaseRate: null }],
      entries: [...car.entries, ...otherEntries()],
      sales: new Map([[SWIFT as string, { soldOn: '2026-10-25', hasPurchaseRate: false }]]),
    });
    const [, oct, nov] = pnl.buckets;

    expect(oct).toMatchObject({
      sales: 0,
      costOfSales: 0,
      grossProfit: 0,
      carsSold: 1,
      carsMissingPurchaseRate: 1,
      uncountedSales: 56_000_000,
    });
    expect(rupees(oct?.netProfit ?? 0)).toBe(1500 - 85000);
    expect(nov?.laterCarCosts).toBe(0);
    expect(rupees(pnl.totals.uncountedSales)).toBe(560000);
  });

  it('over all time equals car profits + other income − business expenses', () => {
    const car = clientCar();
    const all = [...car.entries, ...otherEntries()];
    const pnl = buildProfitAndLoss({
      buckets: ReportPeriod.create('year').bucketsBetween(d('2026-01-01'), d('2026-12-31')),
      soldCars: [car.sold],
      entries: all,
      sales: new Map([[SWIFT as string, { soldOn: '2026-10-25', hasPurchaseRate: true }]]),
    });
    const carProfit = calculateVehicleMoney({
      purchaseRate: car.sold.purchaseRate,
      finalisedPrice: car.sold.finalisedPrice,
      entries: car.entries,
    }).profit;
    const other = all
      .filter((x) => x.kind === 'income' && (x.vehicleId === null || x.purpose === 'other'))
      .reduce((t, x) => t + x.amount.paise, 0);
    const business = all
      .filter((x) => x.kind === 'expense' && x.vehicleId === null)
      .reduce((t, x) => t + x.amount.paise, 0);

    expect(pnl.totals.netProfit).toBe((carProfit ?? 0) + other - business);
  });
});

describe('buildCashFlow', () => {
  it('counts every entry by date, with splits and a running total', () => {
    const car = clientCar();
    const flow = buildCashFlow({
      buckets: ReportPeriod.create('month').bucketsBetween(d('2026-09-01'), d('2026-11-30')),
      entries: [...car.entries, ...otherEntries()],
    });
    const [sep, oct, nov] = flow.buckets;

    expect(rupees(sep?.out ?? 0)).toBe(210000);
    expect(rupees(sep?.outToSellers ?? 0)).toBe(200000);
    expect(oct).toMatchObject({
      inFromBuyers: 56_000_000,
      inOther: 150_000,
      outToSellers: 70_000_000,
      outCarCosts: 4_300_000,
      outBusiness: 8_500_000,
    });
    expect(rupees(nov?.cumulative ?? 0)).toBe(rupees(flow.totals.net));
    expect(flow.totals.in - flow.totals.out).toBe(flow.totals.net);
  });
});
