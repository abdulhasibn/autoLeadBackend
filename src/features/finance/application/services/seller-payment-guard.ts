import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceEntryId } from '../../domain/finance-entry-id';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import type { Money } from '../../domain/money.value-object';
import type { DealTerms, VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealRepository } from '../../domain/vehicle-deal.repository';
import {
  hasDealTerms,
  NO_CURRENT_BUYERS,
  sellerOverpaymentPaise,
  VehicleMoneyTally,
} from '../../domain/vehicle-money';
import type { EntrySealer } from './entry.sealer';
import type { VehicleDealSealer } from './vehicle-deal.sealer';

export interface SellerPaymentCheck {
  readonly vehicle: FinanceVehicleFacts;
  readonly cipher: FinanceCipher;
  /** The terms as stored now; null when there are none. */
  readonly terms: DealTerms | null;
  /** The terms once the change is saved. */
  readonly nextTerms: DealTerms | null;
  /** The recorded sale price (commission cars' payout depends on it). */
  readonly finalisedPrice: Money | null;
  /** Entries the change adds or rewrites (as they will be saved). */
  readonly changed: readonly FinanceEntry[];
  /** Stored entries the change replaces (an edited entry's id). */
  readonly replaces?: readonly FinanceEntryId[];
  readonly keepOverpayment: boolean;
}

/**
 * Keeps payments to the seller tied to the car's deal:
 * - a payment to the seller needs the deal terms (`DEAL_TERMS_REQUIRED`), so
 *   "owed to seller" and profit can always be worked out;
 * - a change that would pay the seller more than they're owed, or more than
 *   they're already overpaid, is refused (`SELLER_PAID_ABOVE_RATE`) unless
 *   `keepOverpayment` says it's real.
 *
 * Amounts are sealed, so the check reads the car's entries here rather than
 * summing them under a database lock: two saves at the same instant can both
 * pass. The money tab then shows the car as overpaid.
 */
export class SellerPaymentGuard {
  constructor(
    private readonly deals: Pick<IVehicleDealRepository, 'find'>,
    private readonly dealSealer: VehicleDealSealer,
    private readonly entries: Pick<IFinanceEntryQueries, 'scan'>,
    private readonly entrySealer: EntrySealer,
  ) {}

  async loadDeal(vehicleId: VehicleId, cipher: FinanceCipher): Promise<VehicleDeal | null> {
    const sealed = await this.deals.find(vehicleId);
    return sealed === null ? null : this.dealSealer.open(sealed, cipher);
  }

  assertTerms(vehicle: FinanceVehicleFacts, terms: DealTerms | null): void {
    if (hasDealTerms(vehicle.saleModel, terms)) return;
    throw new BusinessRuleViolationError(
      'DEAL_TERMS_REQUIRED',
      vehicle.saleModel === 'commission'
        ? 'Set the commission % agreed with the owner before recording a payment to them'
        : 'Set the purchase rate agreed with the seller before recording a payment to them',
    );
  }

  async assertNotOverpaid(check: SellerPaymentCheck): Promise<void> {
    if (check.keepOverpayment) return;
    const replaced = new Set<string>(check.replaces ?? []);
    for (const entry of check.changed) replaced.add(entry.id);

    const before = new VehicleMoneyTally();
    const after = new VehicleMoneyTally();
    for await (const page of this.entries.scan({ vehicleId: check.vehicle.id })) {
      for (const row of page) {
        const entry = this.entrySealer.open(row, check.cipher);
        before.add(entry);
        if (!replaced.has(entry.id)) after.add(entry);
      }
    }
    for (const entry of check.changed) {
      if (entry.vehicleId === check.vehicle.id && !entry.isDeleted) after.add(entry);
    }

    const { finalisedPrice } = check;
    const saleModel = check.vehicle.saleModel;
    const was = before.finish({
      saleModel,
      terms: check.terms,
      finalisedPrice,
      buyers: NO_CURRENT_BUYERS,
    });
    const next = after.finish({
      saleModel,
      terms: check.nextTerms,
      finalisedPrice,
      buyers: NO_CURRENT_BUYERS,
    });
    const overpaid = sellerOverpaymentPaise(next);
    if (overpaid <= sellerOverpaymentPaise(was)) return;

    const limit = (next.owedToSeller ?? 0) + next.paidToSeller;
    throw new BusinessRuleViolationError(
      'SELLER_PAID_ABOVE_RATE',
      saleModel === 'commission'
        ? 'This pays the owner more than they are owed from the sale: check the amount, or keep the overpayment'
        : 'This pays the seller more than the purchase rate: check the amount or the rate, or keep the overpayment',
      {
        paidToSeller: next.paidToSeller / 100,
        owedLimit: limit / 100,
        overpaidBy: overpaid / 100,
      },
    );
  }
}
