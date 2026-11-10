import type { FinanceLeadFacts } from '../../domain/finance-lead-lookup.port';
import type { FinanceTag } from '../../domain/finance-tag.entity';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import type { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { SaleModel } from '../../domain/sale-model';
import { hasDealTerms, type VehicleMoney } from '../../domain/vehicle-money';
import type { VehicleQuote } from '../../domain/vehicle-quote.entity';
import { toVehicleDealStateDto, type VehicleDealStateDto } from './vehicle-deal.dto';
import { toVehicleQuoteDto, type VehicleQuoteDto } from './vehicle-quote.dto';

export interface CostGroupDto {
  /** null = entries with no tag. */
  readonly tag: { readonly id: string; readonly name: string } | null;
  readonly amount: number;
  readonly count: number;
}

/** Everything a car's money tab shows. Rupees; signed where noted. */
export interface VehicleFinanceDto extends VehicleDealStateDto {
  readonly vehicle: { readonly id: string; readonly label: string; readonly saleModel: SaleModel };
  readonly quotes: readonly VehicleQuoteDto[];
  readonly currentQuote: VehicleQuoteDto | null;
  /** Purchase rate + cost entries (commission cars: cost entries only). */
  readonly landingCost: number;
  readonly costs: number;
  readonly costBreakdown: readonly CostGroupDto[];
  readonly paidToSeller: number;
  readonly receivedFromBuyer: number;
  /** Commission cars: our cut of the finalised price; null otherwise or until sold. */
  readonly commission: number | null;
  /** Purchase: finalised − landing cost (negative = loss). Commission: the commission. */
  readonly profit: number | null;
  /**
   * Purchase: rate − paid, null without a rate. Commission: finalised −
   * commission − costs − paid, null until sold. Negative = overpaid.
   */
  readonly owedToSeller: number | null;
  /** Null until the sale is recorded. */
  readonly owedByBuyer: number | null;
  /** `purchaseRateMissing`: the purchase rate or commission % isn't recorded. */
  readonly flags: { readonly purchaseRateMissing: boolean; readonly saleRecorded: boolean };
}

export interface VehicleFinanceSummaryDto {
  readonly vehicleId: string;
  readonly saleModel: SaleModel;
  readonly purchaseRate: number | null;
  readonly commissionPercent: number | null;
  readonly landingCost: number;
  readonly currentQuote: number | null;
  readonly finalisedPrice: number | null;
  readonly profit: number | null;
  readonly owedToSeller: number | null;
  readonly owedByBuyer: number | null;
}

export interface AwaitingSalePriceDto {
  readonly vehicleId: string;
  readonly label: string;
  readonly soldLeadId: string | null;
}

const rupees = (paise: number): number => paise / 100;

/** 350 bp → 3.5; null without a commission. */
export function commissionPercentOf(deal: VehicleDeal | null): number | null {
  const bp = deal?.terms?.commissionBasisPoints ?? null;
  return bp === null ? null : bp / 100;
}
const maybeRupees = (paise: number | null): number | null => (paise === null ? null : paise / 100);

export function toVehicleFinanceDto(input: {
  readonly vehicle: FinanceVehicleFacts;
  readonly deal: VehicleDeal;
  readonly money: VehicleMoney;
  readonly quotes: readonly VehicleQuote[];
  readonly leadsById: ReadonlyMap<string, FinanceLeadFacts>;
  readonly tagsById: ReadonlyMap<string, FinanceTag>;
}): VehicleFinanceDto {
  const { deal, money } = input;
  const quotes = input.quotes.map((quote) => toVehicleQuoteDto(quote, input.leadsById));
  return {
    ...toVehicleDealStateDto(deal),
    vehicle: {
      id: input.vehicle.id,
      label: input.vehicle.label,
      saleModel: input.vehicle.saleModel,
    },
    quotes,
    currentQuote: quotes[0] ?? null,
    landingCost: rupees(money.landingCost),
    costs: rupees(money.costs),
    costBreakdown: money.costBreakdown.map((group) => {
      const tag = group.tagId === null ? undefined : input.tagsById.get(group.tagId);
      return {
        tag:
          group.tagId === null ? null : { id: group.tagId, name: tag?.name.value ?? 'Unknown tag' },
        amount: rupees(group.paise),
        count: group.count,
      };
    }),
    paidToSeller: rupees(money.paidToSeller),
    receivedFromBuyer: rupees(money.receivedFromBuyer),
    commission: maybeRupees(money.commission),
    profit: maybeRupees(money.profit),
    owedToSeller: maybeRupees(money.owedToSeller),
    owedByBuyer: maybeRupees(money.owedByBuyer),
    flags: {
      purchaseRateMissing: !hasDealTerms(input.vehicle.saleModel, deal.terms),
      saleRecorded: deal.sale !== null,
    },
  };
}

export function toVehicleFinanceSummaryDto(input: {
  readonly vehicleId: string;
  readonly saleModel: SaleModel;
  readonly deal: VehicleDeal;
  readonly money: VehicleMoney;
  readonly currentQuote: VehicleQuote | null;
}): VehicleFinanceSummaryDto {
  return {
    vehicleId: input.vehicleId,
    saleModel: input.saleModel,
    purchaseRate: input.deal.terms?.purchaseRate?.rupees ?? null,
    commissionPercent: commissionPercentOf(input.deal),
    landingCost: rupees(input.money.landingCost),
    currentQuote: input.currentQuote?.amount.rupees ?? null,
    finalisedPrice: input.deal.sale?.finalisedPrice.rupees ?? null,
    profit: maybeRupees(input.money.profit),
    owedToSeller: maybeRupees(input.money.owedToSeller),
    owedByBuyer: maybeRupees(input.money.owedByBuyer),
  };
}
