import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';

/**
 * Money from a buyer (income with purpose `sale`) needs a buyer: the car is
 * sold, or a lead on it has its booking confirmed (a token advance before the
 * sale price is recorded). Otherwise the payment is counted as cash in but
 * shows in no dues row (#32).
 */
export class SaleIncomeGuard {
  constructor(private readonly leads: Pick<IFinanceLeadLookup, 'listBookedForVehicle'>) {}

  async assertAllowed(entry: FinanceEntry, vehicle: FinanceVehicleFacts | null): Promise<void> {
    if (entry.kind !== 'income' || entry.purpose !== 'sale' || vehicle === null) {
      return;
    }
    if (vehicle.status === 'sold') {
      return;
    }
    const booked = await this.leads.listBookedForVehicle(vehicle.id);
    if (booked.length > 0) {
      return;
    }
    throw new BusinessRuleViolationError(
      'SALE_NOT_RECORDED',
      'This car has no buyer yet: confirm a booking or record the sale before taking a payment from the buyer, or record it as other income',
    );
  }
}
