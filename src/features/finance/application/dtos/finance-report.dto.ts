import type { CashFlowLine } from '../../domain/build-cash-flow';
import type { ProfitAndLossLine } from '../../domain/build-profit-and-loss';
import type { ReportBucket, ReportPeriodValue } from '../../domain/report-period.value-object';
import type { SaleModel } from '../../domain/sale-model';

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
  readonly saleModel: SaleModel;
  readonly purchaseRate: number | null;
  readonly commissionPercent: number | null;
  /** Commission cars: our cut; null for purchase cars or without a %. */
  readonly commission: number | null;
  readonly costs: number;
  readonly landingCost: number;
  readonly finalisedPrice: number;
  /** Null when the purchase rate or commission % is missing. */
  readonly profit: number | null;
}

export interface VehicleProfitReportDto {
  readonly from: string;
  readonly to: string;
  readonly items: readonly VehicleProfitRowDto[];
  /** `cars` counts every row; the money totals cover only cars whose terms are known. */
  readonly totals: {
    readonly cars: number;
    readonly sales: number;
    readonly landingCost: number;
    /** Commission earned on commission cars (part of `profit`). */
    readonly commissions: number;
    readonly profit: number;
    /** Cars missing their purchase rate or commission %. */
    readonly carsMissingPurchaseRate: number;
    /** Finalised prices of cars without terms. */
    readonly uncountedSales: number;
  };
  readonly truncated: boolean;
}

export interface DuesRowDto {
  readonly vehicle: ReportVehicleDto;
  readonly saleModel: SaleModel;
  readonly purchaseRate: number | null;
  readonly commissionPercent: number | null;
  /** Commission cars: deducted from the owner's payout with `costs`. */
  readonly commission: number | null;
  readonly costs: number;
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
  readonly saleModel: SaleModel;
  readonly purchaseRate: number | null;
  readonly commissionPercent: number | null;
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
  /** Cars sold in the window missing their purchase rate or commission % (left out of profit). */
  readonly carsMissingPurchaseRate: number;
  /** Their finalised prices, not yet counted in sales. */
  readonly uncountedSales: number;
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
