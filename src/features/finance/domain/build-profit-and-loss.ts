import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { FinanceEntry } from './finance-entry.entity';
import type { Money } from './money.value-object';
import { bucketIndexOf, type ReportBucket } from './report-period.value-object';

/** A car whose sale is recorded, with every live entry it has (any date). */
export interface SoldCar {
  readonly vehicleId: VehicleId;
  /** YYYY-MM-DD */
  readonly soldOn: string;
  readonly finalisedPrice: Money;
  readonly purchaseRate: Money | null;
  readonly entries: readonly FinanceEntry[];
}

/** Paise. */
export interface ProfitAndLossLine {
  readonly sales: number;
  readonly costOfSales: number;
  readonly grossProfit: number;
  readonly laterCarCosts: number;
  readonly otherIncome: number;
  readonly businessExpenses: number;
  readonly netProfit: number;
  readonly carsSold: number;
  readonly carsMissingPurchaseRate: number;
}

export interface ProfitAndLoss {
  readonly buckets: readonly (ReportBucket & ProfitAndLossLine)[];
  readonly totals: ProfitAndLossLine;
}

interface MutableLine {
  sales: number;
  costOfSales: number;
  laterCarCosts: number;
  otherIncome: number;
  businessExpenses: number;
  carsSold: number;
  carsMissingPurchaseRate: number;
}

/**
 * Profit & loss in the profit view (ADR-0015, finance-module §4.5):
 * - a car's finalised price, purchase rate and the `cost` entries dated on or
 *   before its sale date all land on the sale date;
 * - `cost` entries dated after the sale land on their own date;
 * - `other` car income and unlinked income / expenses land on their own date;
 * - payments to sellers and from buyers never appear (they settle the prices
 *   above), nor do costs of unsold cars (they're stock).
 * Items dated outside the buckets are ignored, so callers may pass more.
 *
 * @param soldCars cars with a recorded sale (any date)
 * @param entries live entries to place by their own date
 * @param saleDates sale date of every car that has one, to tell later costs apart
 */
export function buildProfitAndLoss(input: {
  readonly buckets: readonly ReportBucket[];
  readonly soldCars: readonly SoldCar[];
  readonly entries: readonly FinanceEntry[];
  readonly saleDates: ReadonlyMap<string, string>;
}): ProfitAndLoss {
  const lines: MutableLine[] = input.buckets.map(() => emptyLine());

  for (const car of input.soldCars) {
    const index = bucketIndexOf(input.buckets, car.soldOn);
    const line = lines[index];
    if (line === undefined) continue;
    const costsUpToSale = car.entries
      .filter((e) => e.purpose === 'cost' && e.entryDate.value <= car.soldOn)
      .reduce((sum, e) => sum + e.amount.paise, 0);
    line.sales += car.finalisedPrice.paise;
    line.costOfSales += (car.purchaseRate?.paise ?? 0) + costsUpToSale;
    line.carsSold += 1;
    if (car.purchaseRate === null) line.carsMissingPurchaseRate += 1;
  }

  for (const entry of input.entries) {
    const line = lines[bucketIndexOf(input.buckets, entry.entryDate.value)];
    if (line === undefined) continue;
    const paise = entry.amount.paise;
    if (entry.vehicleId === null) {
      if (entry.kind === 'income') line.otherIncome += paise;
      else line.businessExpenses += paise;
    } else if (entry.purpose === 'other') {
      line.otherIncome += paise;
    } else if (entry.purpose === 'cost') {
      const soldOn = input.saleDates.get(entry.vehicleId);
      if (soldOn !== undefined && entry.entryDate.value > soldOn) line.laterCarCosts += paise;
    }
  }

  const buckets = input.buckets.map((bucket, i) => ({
    ...bucket,
    ...finish(lines[i] ?? emptyLine()),
  }));
  return { buckets, totals: finish(lines.reduce(addLines, emptyLine())) };
}

function emptyLine(): MutableLine {
  return {
    sales: 0,
    costOfSales: 0,
    laterCarCosts: 0,
    otherIncome: 0,
    businessExpenses: 0,
    carsSold: 0,
    carsMissingPurchaseRate: 0,
  };
}

function addLines(a: MutableLine, b: MutableLine): MutableLine {
  return {
    sales: a.sales + b.sales,
    costOfSales: a.costOfSales + b.costOfSales,
    laterCarCosts: a.laterCarCosts + b.laterCarCosts,
    otherIncome: a.otherIncome + b.otherIncome,
    businessExpenses: a.businessExpenses + b.businessExpenses,
    carsSold: a.carsSold + b.carsSold,
    carsMissingPurchaseRate: a.carsMissingPurchaseRate + b.carsMissingPurchaseRate,
  };
}

function finish(line: MutableLine): ProfitAndLossLine {
  const grossProfit = line.sales - line.costOfSales;
  return {
    ...line,
    grossProfit,
    netProfit: grossProfit - line.laterCarCosts + line.otherIncome - line.businessExpenses,
  };
}
