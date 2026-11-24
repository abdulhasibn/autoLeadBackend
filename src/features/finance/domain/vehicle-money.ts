import type { LeadId } from '../../../domain/shared/lead-id';
import type { FinanceEntry } from './finance-entry.entity';
import type { FinanceTagId } from './finance-tag-id';
import type { Money } from './money.value-object';
import type { SaleModel } from './sale-model';
import type { DealTerms } from './vehicle-deal.entity';

export interface CostGroup {
  /** The first tag on the entries in this group; null = untagged. */
  readonly tagId: FinanceTagId | null;
  readonly paise: number;
  readonly count: number;
}

/** What one current buyer has paid, been refunded and still has with us (paise). */
export interface BuyerMoney {
  readonly leadId: LeadId;
  readonly paid: number;
  readonly refunded: number;
  /** paid − refunded. */
  readonly net: number;
}

/**
 * Money a former buyer (or unassigned money, `leadId: null`) has paid that is
 * still owed back (paise). `owed` = paid − refunded; negative when refunded more
 * than paid.
 */
export interface RefundOwed {
  readonly leadId: LeadId | null;
  readonly paid: number;
  readonly refunded: number;
  readonly owed: number;
}

/**
 * Who counts as the car's buyer (BE-77 §3): the sold lead once the car is
 * sold, the booking-confirmed leads before. Anyone else with money on the car
 * is a former buyer.
 */
export interface CurrentBuyers {
  readonly carSold: boolean;
  readonly soldLeadId: LeadId | null;
  readonly bookedLeadIds: readonly LeadId[];
}

/** For callers that never read buyer figures (seller-payment guard, P&L). */
export const NO_CURRENT_BUYERS: CurrentBuyers = {
  carSold: false,
  soldLeadId: null,
  bookedLeadIds: [],
};

/** The car facts {@link CurrentBuyers} is read from. */
export function currentBuyersOf(
  vehicle: { readonly status: string; readonly soldLeadId: LeadId | null },
  bookedLeadIds: readonly LeadId[],
): CurrentBuyers {
  const carSold = vehicle.status === 'sold';
  return carSold
    ? { carSold, soldLeadId: vehicle.soldLeadId, bookedLeadIds: [] }
    : { carSold, soldLeadId: null, bookedLeadIds };
}

/** All amounts in paise. Signed where a value can go below zero. */
export interface VehicleMoney {
  /** Money we've put into the car: purchase rate + costs (commission cars: costs only). */
  readonly landingCost: number;
  readonly costs: number;
  readonly costBreakdown: readonly CostGroup[];
  readonly paidToSeller: number;
  /** Net (paid − refunded) over the current buyers; unassigned money only when it counts as theirs. */
  readonly receivedFromBuyer: number;
  /** One row per current buyer. */
  readonly buyers: readonly BuyerMoney[];
  /** Former buyers with money still owed back, plus one `leadId: null` row for unassigned money. */
  readonly refundsOwed: readonly RefundOwed[];
  /** Commission cars: our cut of the finalised price; null for purchase cars or until sold. */
  readonly commission: number | null;
  /**
   * Purchase cars: finalised − landing. Commission cars: the commission (costs
   * are recovered from the owner). Null until the terms and the sale are known.
   */
  readonly profit: number | null;
  /**
   * Purchase cars: purchase rate − paid to seller, null without a rate.
   * Commission cars: finalised − commission − costs − paid to owner, null until
   * sold. Negative = overpaid.
   */
  readonly owedToSeller: number | null;
  /** finalised − net of the sale's lead; null until the sale is recorded. */
  readonly owedByBuyer: number | null;
}

/** True when the terms needed for this car's profit are recorded. */
export function hasDealTerms(saleModel: SaleModel, terms: DealTerms | null): boolean {
  return saleModel === 'purchase'
    ? (terms?.purchaseRate ?? null) !== null
    : (terms?.commissionBasisPoints ?? null) !== null;
}

/** Commission on a price, rounded to the paisa. */
export function commissionOn(price: Money, basisPoints: number): number {
  return Math.round((price.paise * basisPoints) / 10_000);
}

/**
 * A car's money (ADR-0015, ADR-0017).
 *
 * Purchase cars: landing cost = purchase rate + `cost` expenses; profit =
 * finalised − landing cost. `purchase` expenses settle the purchase rate.
 *
 * Commission cars: profit = commission % × finalised. `cost` expenses are
 * recovered from the owner's payout, so we owe the owner finalised −
 * commission − costs, settled by `purchase` expenses (payouts).
 *
 * `sale` income settles the finalised price in both, per buyer: only the lead
 * who buys counts (BE-77); `refund` expenses pay a buyer back. Terms that don't fit the
 * sale model are ignored. Entries must be the car's live entries.
 */
export function calculateVehicleMoney(input: {
  readonly saleModel: SaleModel;
  readonly terms: DealTerms | null;
  readonly finalisedPrice: Money | null;
  readonly entries: readonly FinanceEntry[];
  readonly buyers: CurrentBuyers;
}): VehicleMoney {
  const tally = new VehicleMoneyTally();
  for (const entry of input.entries) tally.add(entry);
  return tally.finish(input);
}

/** Key for buyer entries with no lead. */
const UNASSIGNED = '';

function bump(map: Map<string, number>, key: string, paise: number): void {
  map.set(key, (map.get(key) ?? 0) + paise);
}

/**
 * {@link calculateVehicleMoney} one entry at a time, so a report can fold a
 * car's entries page by page without holding them. Feed it every live entry
 * of one car, then `finish`.
 */
export class VehicleMoneyTally {
  private costs = 0;
  private paidToSeller = 0;
  private costsOnOrBeforeSale = 0;
  /** Buyer money per lead; entries with no lead sit under {@link UNASSIGNED}. */
  private readonly paid = new Map<string, number>();
  private readonly refunded = new Map<string, number>();
  private readonly groups = new Map<
    string,
    { tagId: FinanceTagId | null; paise: number; count: number }
  >();

  /**
   * @param soldOn the car's sale date (YYYY-MM-DD), when it has one: the
   *   tally then also sums the `cost` entries dated on or before it, which
   *   P&L counts in cost of sales.
   */
  constructor(private readonly soldOn: string | null = null) {}

  add(entry: FinanceEntry): void {
    const paise = entry.amount.paise;
    if (entry.purpose === 'cost') {
      this.costs += paise;
      if (this.soldOn !== null && entry.entryDate.value <= this.soldOn) {
        this.costsOnOrBeforeSale += paise;
      }
      const tagId = entry.tagIds[0] ?? null;
      const key = tagId ?? '';
      const group = this.groups.get(key) ?? { tagId, paise: 0, count: 0 };
      this.groups.set(key, { tagId, paise: group.paise + paise, count: group.count + 1 });
    } else if (entry.purpose === 'purchase') {
      this.paidToSeller += paise;
    } else if (entry.purpose === 'sale') {
      bump(this.paid, entry.leadId ?? UNASSIGNED, paise);
    } else if (entry.purpose === 'refund') {
      bump(this.refunded, entry.leadId ?? UNASSIGNED, paise);
    }
  }

  /** Paise of `sale` entries added so far that carry this lead. */
  paidBy(leadId: LeadId): number {
    return this.paid.get(leadId) ?? 0;
  }

  /**
   * Net (paid − refunded) per lead as the car's buyers see it: on a sold car
   * with a sold lead, unassigned money counts as theirs (§4.4). Unassigned
   * money elsewhere is under the key ''.
   */
  netByLead(current: CurrentBuyers): Map<string, number> {
    const { paid, refunded } = this;
    const net = new Map<string, number>();
    for (const [id, paise] of paid) bump(net, id, paise);
    for (const [id, paise] of refunded) bump(net, id, -paise);
    if (current.carSold && current.soldLeadId !== null) {
      const loose = net.get(UNASSIGNED) ?? 0;
      net.delete(UNASSIGNED);
      bump(net, current.soldLeadId, loose);
    }
    return net;
  }

  /** Every lead id that has buyer money on the car so far. */
  leadIds(): LeadId[] {
    return [...new Set([...this.paid.keys(), ...this.refunded.keys()])].filter(
      (key) => key !== UNASSIGNED,
    ) as LeadId[];
  }

  /** Paise of `cost` entries dated on or before the sale date; 0 without one. */
  get costsUpToSale(): number {
    return this.costsOnOrBeforeSale;
  }

  finish(input: {
    readonly saleModel: SaleModel;
    readonly terms: DealTerms | null;
    readonly finalisedPrice: Money | null;
    readonly buyers: CurrentBuyers;
  }): VehicleMoney {
    const { costs, paidToSeller } = this;
    const finalised = input.finalisedPrice?.paise ?? null;
    const { buyers, refundsOwed, receivedFromBuyer, saleNet } = this.buyerFigures(input.buyers);
    const shared = {
      costs,
      costBreakdown: [...this.groups.values()].sort((a, b) => b.paise - a.paise),
      paidToSeller,
      receivedFromBuyer,
      buyers,
      refundsOwed,
      owedByBuyer: finalised === null ? null : finalised - saleNet,
    };

    if (input.saleModel === 'commission') {
      const basisPoints = input.terms?.commissionBasisPoints ?? null;
      const commission =
        basisPoints === null || input.finalisedPrice === null
          ? null
          : commissionOn(input.finalisedPrice, basisPoints);
      return {
        ...shared,
        landingCost: costs,
        commission,
        profit: commission,
        owedToSeller:
          commission === null || finalised === null
            ? null
            : finalised - commission - costs - paidToSeller,
      };
    }

    const purchaseRate = input.terms?.purchaseRate?.paise ?? null;
    const landingCost = (purchaseRate ?? 0) + costs;
    return {
      ...shared,
      landingCost,
      commission: null,
      profit: purchaseRate !== null && finalised !== null ? finalised - landingCost : null,
      owedToSeller: purchaseRate === null ? null : purchaseRate - paidToSeller,
    };
  }
  /**
   * Splits the buyer money by lead (BE-77 §3-4.5). On a sold car, entries with
   * no lead count as the sold lead's (a sold car with no sold lead keeps them as
   * current money); everywhere else they are unassigned.
   */
  private buyerFigures(current: CurrentBuyers): {
    buyers: BuyerMoney[];
    refundsOwed: RefundOwed[];
    receivedFromBuyer: number;
    saleNet: number;
  } {
    const paidBy = this.paid;
    const refundedBy = this.refunded;
    const unassignedPaid = paidBy.get(UNASSIGNED) ?? 0;
    const unassignedRefunded = refundedBy.get(UNASSIGNED) ?? 0;
    const currentIds = current.carSold
      ? current.soldLeadId === null
        ? []
        : [current.soldLeadId]
      : [...new Set(current.bookedLeadIds)];
    const absorbsUnassigned = current.carSold;

    const buyers = currentIds.map((leadId): BuyerMoney => {
      const takes = absorbsUnassigned && leadId === current.soldLeadId;
      const paid = (paidBy.get(leadId) ?? 0) + (takes ? unassignedPaid : 0);
      const refunded = (refundedBy.get(leadId) ?? 0) + (takes ? unassignedRefunded : 0);
      return { leadId, paid, refunded, net: paid - refunded };
    });

    const refundsOwed: RefundOwed[] = [];
    const former = new Set<string>([...paidBy.keys(), ...refundedBy.keys()]);
    former.delete(UNASSIGNED);
    for (const id of currentIds) former.delete(id);
    for (const id of former) {
      const paid = paidBy.get(id) ?? 0;
      const refunded = refundedBy.get(id) ?? 0;
      if (paid - refunded !== 0) {
        refundsOwed.push({ leadId: id as LeadId, paid, refunded, owed: paid - refunded });
      }
    }
    refundsOwed.sort((a, b) => b.owed - a.owed);
    // A sold car with no sold lead keeps its unassigned money as the buyer's, as before.
    const unassignedIsCurrent = current.carSold;
    const unassignedNet = unassignedPaid - unassignedRefunded;
    if (!unassignedIsCurrent && unassignedNet !== 0) {
      refundsOwed.push({
        leadId: null,
        paid: unassignedPaid,
        refunded: unassignedRefunded,
        owed: unassignedNet,
      });
    }

    const attributed = buyers.reduce((t, b) => t + b.net, 0);
    const soldWithoutLead = current.carSold && current.soldLeadId === null;
    const receivedFromBuyer = attributed + (soldWithoutLead ? unassignedNet : 0);
    const saleNet = current.carSold
      ? (buyers[0]?.net ?? (soldWithoutLead ? unassignedNet : 0))
      : receivedFromBuyer;
    return { buyers, refundsOwed, receivedFromBuyer, saleNet };
  }
}

/**
 * How far the payments to the seller (owner, for commission cars) have got:
 * `no_terms` until the terms the limit depends on are known (commission cars:
 * also the sale), else none / part / full / overpaid.
 */
export type SellerPaymentStatus = 'no_terms' | 'none' | 'part' | 'full' | 'overpaid';

export function sellerPaymentStatus(money: VehicleMoney): SellerPaymentStatus {
  const owed = money.owedToSeller;
  if (owed === null) return 'no_terms';
  if (owed < 0) return 'overpaid';
  if (owed === 0) return 'full';
  return money.paidToSeller === 0 ? 'none' : 'part';
}

/** Paise paid to the seller beyond what they're owed; 0 when not overpaid or unknown. */
export function sellerOverpaymentPaise(money: VehicleMoney): number {
  return money.owedToSeller === null ? 0 : Math.max(0, -money.owedToSeller);
}

/** A payment to the car's seller (owner, for commission cars): a car-linked `purchase` expense. */
export function isSellerPayment(entry: {
  readonly kind: string;
  readonly purpose: string;
  readonly vehicleId: string | null;
}): boolean {
  return entry.kind === 'expense' && entry.purpose === 'purchase' && entry.vehicleId !== null;
}
