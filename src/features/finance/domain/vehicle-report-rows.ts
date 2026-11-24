import type { VehicleDeal } from './vehicle-deal.entity';
import type { VehicleMoney } from './vehicle-money';

/**
 * A car is stock while its sale isn't recorded and it isn't marked sold.
 * Dropped cars stay in stock until the admin deals with them (finance-module
 * §4.6). Only cars with money in them are listed.
 */
export function isInStock(deal: VehicleDeal | null, status: string, money: VehicleMoney): boolean {
  return (
    (deal?.sale ?? null) === null &&
    status !== 'sold' &&
    (money.landingCost > 0 || money.paidToSeller > 0)
  );
}

/**
 * Cash actually paid out on an unsold car, in paise: payments to the seller
 * (an advance, for a commission car) plus `cost` entries. The agreed purchase
 * rate is not part of it (ADR-0015/0017 amendment, BE-78).
 */
export function cashPaidOnCar(money: VehicleMoney): number {
  return money.paidToSeller + money.costs;
}

/** Something is still owed either way (overpaid counts too). */
export function hasDues(money: VehicleMoney): boolean {
  return (
    (money.owedToSeller !== null && money.owedToSeller !== 0) ||
    (money.owedByBuyer !== null && money.owedByBuyer !== 0)
  );
}
