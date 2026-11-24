import type { FinanceLeadFacts } from '../../domain/finance-lead-lookup.port';
import type { FinanceTag } from '../../domain/finance-tag.entity';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import type { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { SaleModel } from '../../domain/sale-model';
import {
  hasDealTerms,
  sellerPaymentStatus,
  type SellerPaymentStatus,
  type VehicleMoney,
} from '../../domain/vehicle-money';
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
  readonly vehicle: {
    readonly id: string;
    readonly label: string;
    readonly saleModel: SaleModel;
    /** Car status (`open`, `linked`, `dropped`, `sold`). */
    readonly status: string;
  };
  /**
   * Booking-confirmed leads on a car that isn't sold yet: recording the sale
   * converts one of them. Empty once the car is sold.
   */
  readonly bookedLeads: readonly BookedLeadDto[];
  readonly quotes: readonly VehicleQuoteDto[];
  readonly currentQuote: VehicleQuoteDto | null;
  /** Purchase rate + cost entries (commission cars: cost entries only). */
  readonly landingCost: number;
  readonly costs: number;
  readonly costBreakdown: readonly CostGroupDto[];
  readonly paidToSeller: number;
  /** Net (paid − refunded) over the current buyers. */
  readonly receivedFromBuyer: number;
  /** One row per current buyer: booked leads before the sale, the sold lead after. */
  readonly buyers: readonly BuyerDto[];
  /** Former buyers' money still owed back, plus one `lead: null` row for unassigned money. */
  readonly refundsOwed: readonly RefundOwedDto[];
  /** Commission cars: our cut of the finalised price; null otherwise or until sold. */
  readonly commission: number | null;
  /** Purchase: finalised − landing cost (negative = loss). Commission: the commission. */
  readonly profit: number | null;
  /**
   * Purchase: rate − paid, null without a rate. Commission: finalised −
   * commission − costs − paid, null until sold. Negative = overpaid.
   */
  readonly owedToSeller: number | null;
  /** finalised − the sale lead's net; null until the sale is recorded. */
  readonly owedByBuyer: number | null;
  /**
   * How far the payments to the seller (owner) have got: `no_terms` while
   * "owed to seller" can't be worked out, else none / part / full / overpaid.
   */
  readonly sellerPaymentStatus: SellerPaymentStatus;
  /**
   * `purchaseRateMissing`: the purchase rate or commission % isn't recorded.
   * `paidWithoutTerms`: money was paid to the seller but those terms are missing.
   */
  readonly flags: {
    readonly purchaseRateMissing: boolean;
    readonly saleRecorded: boolean;
    readonly paidWithoutTerms: boolean;
  };
}

/** A lead as the money screens show them. */
export interface BuyerLeadDto {
  readonly id: string;
  readonly name: string | null;
  readonly phone: string | null;
}

export interface BuyerDto {
  readonly lead: BuyerLeadDto;
  readonly paid: number;
  readonly refunded: number;
  /** paid − refunded. */
  readonly net: number;
}

export interface RefundOwedDto {
  /** null = unassigned buyer money (older entries with no lead). */
  readonly lead: BuyerLeadDto | null;
  readonly paid: number;
  readonly refunded: number;
  /** paid − refunded; negative = refunded more than paid. */
  readonly owed: number;
}

export function toBuyerLeadDto(
  id: string,
  leadsById: ReadonlyMap<string, FinanceLeadFacts>,
): BuyerLeadDto {
  const lead = leadsById.get(id);
  return {
    id,
    name: lead?.name ?? (lead?.deleted === true ? 'Deleted lead' : null),
    phone: lead?.phone ?? null,
  };
}

export function toBuyerDtos(
  money: VehicleMoney,
  leadsById: ReadonlyMap<string, FinanceLeadFacts>,
): { buyers: BuyerDto[]; refundsOwed: RefundOwedDto[] } {
  return {
    buyers: money.buyers.map((b) => ({
      lead: toBuyerLeadDto(b.leadId, leadsById),
      paid: rupees(b.paid),
      refunded: rupees(b.refunded),
      net: rupees(b.net),
    })),
    refundsOwed: money.refundsOwed.map((r) => ({
      lead: r.leadId === null ? null : toBuyerLeadDto(r.leadId, leadsById),
      paid: rupees(r.paid),
      refunded: rupees(r.refunded),
      owed: rupees(r.owed),
    })),
  };
}

export interface BookedLeadDto {
  readonly id: string;
  readonly name: string | null;
  readonly phone: string | null;
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
  readonly bookedLeads: readonly FinanceLeadFacts[];
  /** Every lead named in `money.buyers` / `money.refundsOwed`. */
  readonly buyerLeads: ReadonlyMap<string, FinanceLeadFacts>;
  readonly tagsById: ReadonlyMap<string, FinanceTag>;
}): VehicleFinanceDto {
  const { deal, money } = input;
  const quotes = input.quotes.map((quote) => toVehicleQuoteDto(quote, input.leadsById));
  const hasTerms = hasDealTerms(input.vehicle.saleModel, deal.terms);
  return {
    ...toVehicleDealStateDto(deal),
    vehicle: {
      id: input.vehicle.id,
      label: input.vehicle.label,
      saleModel: input.vehicle.saleModel,
      status: input.vehicle.status,
    },
    bookedLeads: input.bookedLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
    })),
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
    ...toBuyerDtos(money, input.buyerLeads),
    commission: maybeRupees(money.commission),
    profit: maybeRupees(money.profit),
    owedToSeller: maybeRupees(money.owedToSeller),
    owedByBuyer: maybeRupees(money.owedByBuyer),
    sellerPaymentStatus: sellerPaymentStatus(money),
    flags: {
      purchaseRateMissing: !hasTerms,
      saleRecorded: deal.sale !== null,
      paidWithoutTerms: !hasTerms && money.paidToSeller > 0,
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
