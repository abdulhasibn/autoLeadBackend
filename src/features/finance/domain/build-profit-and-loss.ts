import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { FinanceEntry } from './finance-entry.entity';
import type { Money } from './money.value-object';
import { bucketIndexOf, type ReportBucket } from './report-period.value-object';
import type { SaleModel } from './sale-model';
import type { DealTerms } from './vehicle-deal.entity';
import { commissionOn, hasDealTerms, VehicleMoneyTally } from './vehicle-money';

/** A car whose sale is recorded, with every live entry it has (any date). */
export interface SoldCar {
  readonly vehicleId: VehicleId;
  /** YYYY-MM-DD */
  readonly soldOn: string;
  readonly finalisedPrice: Money;
  readonly saleModel: SaleModel;
  readonly terms: DealTerms | null;
  readonly entries: readonly FinanceEntry[];
}

/** A sold car with its pre-sale costs already summed, so P&L needs no entry list. */
export interface SoldCarFigures extends Omit<SoldCar, 'entries'> {
  /** Paise of the car's `cost` entries dated on or before `soldOn`. */
  readonly costsUpToSale: number;
}

/** What the report needs to know about every car with a recorded sale. */
export interface SaleInfo {
  /** YYYY-MM-DD */
  readonly soldOn: string;
  /**
   * True for a purchase car with a purchase rate: its costs after the sale are
   * later car costs. Commission cars' costs are recovered from the owner and
   * never reach P&L; cars without terms have unknown profit.
   */
  readonly countsLaterCosts: boolean;
}

/** Paise. */
export interface ProfitAndLossLine {
  /** Finalised prices of sold purchase cars whose purchase rate is known. */
  readonly sales: number;
  readonly costOfSales: number;
  /** Commission earned on commission cars sold (ADR-0017). */
  readonly commissions: number;
  /** sales − cost of sales + commissions. */
  readonly grossProfit: number;
  readonly laterCarCosts: number;
  readonly otherIncome: number;
  readonly businessExpenses: number;
  readonly netProfit: number;
  readonly carsSold: number;
  /** Sold cars missing their purchase rate or commission %. */
  readonly carsMissingPurchaseRate: number;
  /** Finalised prices of sold cars left out because their terms are missing. */
  readonly uncountedSales: number;
}

export interface ProfitAndLoss {
  readonly buckets: readonly (ReportBucket & ProfitAndLossLine)[];
  readonly totals: ProfitAndLossLine;
}

interface MutableLine {
  sales: number;
  costOfSales: number;
  commissions: number;
  laterCarCosts: number;
  otherIncome: number;
  businessExpenses: number;
  carsSold: number;
  carsMissingPurchaseRate: number;
  uncountedSales: number;
}

/**
 * Profit & loss in the profit view (ADR-0015, finance-module §4.5):
 * - a car's finalised price, purchase rate and the `cost` entries dated on or
 *   before its sale date all land on the sale date;
 * - `cost` entries dated after the sale land on their own date;
 * - `other` car income and unlinked income / expenses land on their own date;
 * - payments to sellers and from buyers never appear (they settle the prices
 *   above), nor do costs of unsold cars (they're stock);
 * - a sold commission car adds its commission on the sale date; its costs are
 *   recovered from the owner, so they never appear (ADR-0017);
 * - a sold car without its purchase rate or commission % has unknown profit:
 *   it is counted (`carsSold`, `carsMissingPurchaseRate`) but left out of
 *   sales, cost of sales and profit, with its later costs; its price shows as
 *   `uncountedSales`.
 * Items dated outside the buckets are ignored, so callers may pass more.
 *
 * @param soldCars cars with a recorded sale (any date)
 * @param entries live entries to place by their own date
 * @param sales sale date and later-cost rule of every car with a sale,
 *   to tell later costs apart
 */
export function buildProfitAndLoss(input: {
  readonly buckets: readonly ReportBucket[];
  readonly soldCars: readonly SoldCar[];
  readonly entries: readonly FinanceEntry[];
  readonly sales: ReadonlyMap<string, SaleInfo>;
}): ProfitAndLoss {
  const tally = new ProfitAndLossTally(input.buckets);
  for (const car of input.soldCars) {
    const money = new VehicleMoneyTally(car.soldOn);
    for (const entry of car.entries) money.add(entry);
    tally.addSoldCar({ ...car, costsUpToSale: money.costsUpToSale });
  }
  for (const entry of input.entries) {
    tally.addEntry(entry, entry.vehicleId === null ? undefined : input.sales.get(entry.vehicleId));
  }
  return tally.result();
}

/**
 * {@link buildProfitAndLoss} one item at a time, so a report can fold the
 * ledger page by page. Same rules; items dated outside the buckets are ignored.
 */
export class ProfitAndLossTally {
  private readonly lines: MutableLine[];

  constructor(private readonly buckets: readonly ReportBucket[]) {
    this.lines = buckets.map(() => emptyLine());
  }

  addSoldCar(car: SoldCarFigures): void {
    const line = this.lines[bucketIndexOf(this.buckets, car.soldOn)];
    if (line === undefined) return;
    line.carsSold += 1;
    if (!hasDealTerms(car.saleModel, car.terms)) {
      line.carsMissingPurchaseRate += 1;
      line.uncountedSales += car.finalisedPrice.paise;
      return;
    }
    if (car.saleModel === 'commission') {
      line.commissions += commissionOn(car.finalisedPrice, car.terms?.commissionBasisPoints ?? 0);
      return;
    }
    line.sales += car.finalisedPrice.paise;
    line.costOfSales += (car.terms?.purchaseRate?.paise ?? 0) + car.costsUpToSale;
  }

  /**
   * @param sale the sale info of the entry's car, if it has a recorded sale,
   *   to tell later costs apart
   */
  addEntry(entry: FinanceEntry, sale: SaleInfo | undefined): void {
    const line = this.lines[bucketIndexOf(this.buckets, entry.entryDate.value)];
    if (line === undefined) return;
    const paise = entry.amount.paise;
    if (entry.vehicleId === null) {
      if (entry.kind === 'income') line.otherIncome += paise;
      else line.businessExpenses += paise;
    } else if (entry.purpose === 'other') {
      line.otherIncome += paise;
    } else if (entry.purpose === 'cost') {
      if (sale !== undefined && sale.countsLaterCosts && entry.entryDate.value > sale.soldOn) {
        line.laterCarCosts += paise;
      }
    }
  }

  result(): ProfitAndLoss {
    const buckets = this.buckets.map((bucket, i) => ({
      ...bucket,
      ...finish(this.lines[i] ?? emptyLine()),
    }));
    return { buckets, totals: finish(this.lines.reduce(addLines, emptyLine())) };
  }
}

function emptyLine(): MutableLine {
  return {
    sales: 0,
    costOfSales: 0,
    commissions: 0,
    laterCarCosts: 0,
    otherIncome: 0,
    businessExpenses: 0,
    carsSold: 0,
    carsMissingPurchaseRate: 0,
    uncountedSales: 0,
  };
}

function addLines(a: MutableLine, b: MutableLine): MutableLine {
  return {
    sales: a.sales + b.sales,
    costOfSales: a.costOfSales + b.costOfSales,
    commissions: a.commissions + b.commissions,
    laterCarCosts: a.laterCarCosts + b.laterCarCosts,
    otherIncome: a.otherIncome + b.otherIncome,
    businessExpenses: a.businessExpenses + b.businessExpenses,
    carsSold: a.carsSold + b.carsSold,
    carsMissingPurchaseRate: a.carsMissingPurchaseRate + b.carsMissingPurchaseRate,
    uncountedSales: a.uncountedSales + b.uncountedSales,
  };
}

function finish(line: MutableLine): ProfitAndLossLine {
  const grossProfit = line.sales - line.costOfSales + line.commissions;
  return {
    ...line,
    grossProfit,
    netProfit: grossProfit - line.laterCarCosts + line.otherIncome - line.businessExpenses,
  };
}
