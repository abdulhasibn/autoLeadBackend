import type { FinanceEntry } from './finance-entry.entity';
import type { FinanceTagId } from './finance-tag-id';
import type { Money } from './money.value-object';

export interface CostGroup {
  /** The first tag on the entries in this group; null = untagged. */
  readonly tagId: FinanceTagId | null;
  readonly paise: number;
  readonly count: number;
}

/** All amounts in paise. Signed where a value can go below zero. */
export interface VehicleMoney {
  readonly landingCost: number;
  readonly costs: number;
  readonly costBreakdown: readonly CostGroup[];
  readonly paidToSeller: number;
  readonly receivedFromBuyer: number;
  /** finalised − landing; null until the purchase rate and the sale are both known. */
  readonly profit: number | null;
  /** purchase rate − paid to seller; negative = overpaid; null without a purchase rate. */
  readonly owedToSeller: number | null;
  /** finalised − received from buyer; null until the sale is recorded. */
  readonly owedByBuyer: number | null;
}

/**
 * A car's money, by the client's rule (ADR-0015, ADR-0009):
 * landing cost = purchase rate + `cost` expenses; profit = finalised −
 * landing cost. `purchase` expenses settle the purchase rate and `sale`
 * income settles the finalised price, so neither is counted twice.
 * Entries must be the car's live entries.
 */
export function calculateVehicleMoney(input: {
  readonly purchaseRate: Money | null;
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

  const purchaseRate = input.purchaseRate?.paise ?? null;
  const finalised = input.finalisedPrice?.paise ?? null;
  const landingCost = (purchaseRate ?? 0) + costs;

  return {
    landingCost,
    costs,
    costBreakdown: [...groups.values()].sort((a, b) => b.paise - a.paise),
    paidToSeller,
    receivedFromBuyer,
    profit: purchaseRate !== null && finalised !== null ? finalised - landingCost : null,
    owedToSeller: purchaseRate === null ? null : purchaseRate - paidToSeller,
    owedByBuyer: finalised === null ? null : finalised - receivedFromBuyer,
  };
}
