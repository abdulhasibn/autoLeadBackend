import type { CashFlowLine } from '../../domain/build-cash-flow';
import type { ProfitAndLossLine } from '../../domain/build-profit-and-loss';
import type { ReportBucket, ReportPeriodValue } from '../../domain/report-period.value-object';

/** Every money field below is rupees; signed where a value can go negative. */
export type ProfitAndLossLineDto = ProfitAndLossLine;
export type CashFlowLineDto = CashFlowLine;

export interface ProfitAndLossReportDto {
  readonly period: ReportPeriodValue;
  readonly from: string;
  readonly to: string;
  readonly buckets: readonly (ReportBucket & ProfitAndLossLineDto)[];
  readonly totals: ProfitAndLossLineDto;
  readonly truncated: boolean;
}

export interface CashFlowReportDto {
  readonly period: ReportPeriodValue;
  readonly from: string;
  readonly to: string;
  readonly buckets: readonly (ReportBucket & CashFlowLineDto & { readonly cumulative: number })[];
  readonly totals: CashFlowLineDto;
  readonly truncated: boolean;
}

export interface ReportVehicleDto {
  readonly id: string;
  readonly label: string;
}

export interface VehicleProfitRowDto {
  readonly vehicle: ReportVehicleDto;
  readonly soldOn: string;
  readonly purchaseRate: number | null;
  readonly costs: number;
  readonly landingCost: number;
  readonly finalisedPrice: number;
  /** Null when the purchase rate is missing. */
  readonly profit: number | null;
}

export interface VehicleProfitReportDto {
  readonly from: string;
  readonly to: string;
  readonly items: readonly VehicleProfitRowDto[];
  readonly totals: {
    readonly cars: number;
    readonly sales: number;
    readonly landingCost: number;
    /** Over cars with a purchase rate. */
    readonly profit: number;
  };
  readonly truncated: boolean;
}

export interface DuesRowDto {
  readonly vehicle: ReportVehicleDto;
  readonly purchaseRate: number | null;
  readonly paidToSeller: number;
  /** Negative = overpaid. */
  readonly owedToSeller: number | null;
  readonly finalisedPrice: number | null;
  readonly receivedFromBuyer: number;
  /** Negative = buyer paid more than the finalised price. */
  readonly owedByBuyer: number | null;
}

export interface DuesReportDto {
  readonly items: readonly DuesRowDto[];
  /** Sums of what is still owed (positive amounts only). */
  readonly totals: { readonly owedToSellers: number; readonly owedByBuyers: number };
  readonly truncated: boolean;
}

export interface StockRowDto {
  readonly vehicle: ReportVehicleDto;
  readonly status: string;
  readonly purchaseRate: number | null;
  readonly costs: number;
  readonly landingCost: number;
  readonly currentQuote: number | null;
  readonly listedPrice: number | null;
}

export interface StockReportDto {
  readonly items: readonly StockRowDto[];
  readonly totals: { readonly cars: number; readonly moneyInStock: number };
  readonly truncated: boolean;
}

export interface SummaryWindowDto {
  readonly from: string;
  readonly to: string;
  readonly sales: number;
  readonly netProfit: number;
  readonly businessExpenses: number;
  readonly cashIn: number;
  readonly cashOut: number;
}

export interface FinanceSummaryDto {
  /** Month to date. */
  readonly thisMonth: SummaryWindowDto;
  /** The same span of last month (1st to the same day, or month end). */
  readonly lastMonth: SummaryWindowDto;
  readonly moneyInStock: number;
  readonly owedToSellers: number;
  readonly owedByBuyers: number;
  readonly awaitingSalePrice: number;
  readonly truncated: boolean;
}

/** Paise → rupees for every numeric field except counts. */
export function rupeesOf<T extends object>(line: T, counts: readonly string[] = []): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(line)) {
    out[key] = typeof value === 'number' && !counts.includes(key) ? value / 100 : value;
  }
  return out as T;
}

export const PNL_COUNT_FIELDS = ['carsSold', 'carsMissingPurchaseRate'] as const;
