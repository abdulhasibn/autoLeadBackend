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

/** All amounts in paise. Signed where a value can go below zero. */
export interface VehicleMoney {
  /** Money we've put into the car: purchase rate + costs (commission cars: costs only). */
  readonly landingCost: number;
  readonly costs: number;
  readonly costBreakdown: readonly CostGroup[];
  readonly paidToSeller: number;
  readonly receivedFromBuyer: number;
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
  /** finalised − received from buyer; null until the sale is recorded. */
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
 * `sale` income settles the finalised price in both. Terms that don't fit the
 * sale model are ignored. Entries must be the car's live entries.
 */
export function calculateVehicleMoney(input: {
  readonly saleModel: SaleModel;
  readonly terms: DealTerms | null;
  readonly finalisedPrice: Money | null;
  readonly entries: readonly FinanceEntry[];
}): VehicleMoney {
  let costs = 0;
  let paidToSeller = 0;
  let receivedFromBuyer = 0;
  const groups = new Map<string, { tagId: FinanceTagId | null; paise: number; count: number }>();

  for (const entry of input.entries) {
    const paise = entry.amount.paise;
    if (entry.purpose === 'cost') {
      costs += paise;
      const tagId = entry.tagIds[0] ?? null;
      const key = tagId ?? '';
      const group = groups.get(key) ?? { tagId, paise: 0, count: 0 };
      groups.set(key, { tagId, paise: group.paise + paise, count: group.count + 1 });
    } else if (entry.purpose === 'purchase') {
      paidToSeller += paise;
    } else if (entry.purpose === 'sale') {
      receivedFromBuyer += paise;
    }
  }

  const finalised = input.finalisedPrice?.paise ?? null;
  const shared = {
    costs,
    costBreakdown: [...groups.values()].sort((a, b) => b.paise - a.paise),
    paidToSeller,
    receivedFromBuyer,
    owedByBuyer: finalised === null ? null : finalised - receivedFromBuyer,
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
