import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import type { LeadId } from '../../../../domain/shared/lead-id';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import { VehicleMoneyTally } from '../../domain/vehicle-money';
import type { CarBuyers } from './car-buyers';
import type { EntrySealer } from './entry.sealer';

/**
 * A refund (expense, purpose `refund`) pays a buyer's money back (BE-77 §4.12):
 * - it names the lead, or the only lead with something to get back;
 * - it may not take that lead's net (paid − refunded) below zero
 *   (`REFUND_ABOVE_PAID`). The entry being edited is left out of the total.
 * Unassigned money can't be refunded until it is assigned to a lead.
 *
 * Reads entries without a lock (as the seller-payment check does): two saves at
 * the same instant can over-refund.
 */
export class RefundGuard {
  constructor(
    private readonly entries: Pick<IFinanceEntryQueries, 'scan'>,
    private readonly entrySealer: EntrySealer,
    private readonly buyers: CarBuyers,
  ) {}

  /** Sets the lead on a car-linked `refund` expense after checking the limit; else does nothing. */
  async attribute(
    entry: FinanceEntry,
    vehicle: FinanceVehicleFacts | null,
    requested: LeadId | null,
    cipher: FinanceCipher,
    now: Date,
  ): Promise<void> {
    if (entry.kind !== 'expense' || entry.purpose !== 'refund' || vehicle === null) {
      return;
    }
    const tally = new VehicleMoneyTally();
    for await (const page of this.entries.scan({ vehicleId: vehicle.id })) {
      for (const row of page) {
        if (row.id === entry.id) continue;
        tally.add(this.entrySealer.open(row, cipher));
      }
    }
    const { buyers } = await this.buyers.resolve([{ vehicle, tally }]);
    const current = buyers.get(vehicle.id);
    const net = current === undefined ? new Map<string, number>() : tally.netByLead(current);

    let leadId = requested;
    if (leadId === null) {
      const owed = [...net].filter(([id, n]) => id !== '' && n > 0).map(([id]) => id as LeadId);
      if (owed.length !== 1 || owed[0] === undefined) {
        throw new BusinessRuleViolationError(
          'REFUND_LEAD_REQUIRED',
          owed.length === 0
            ? 'Nobody has paid money on this car that can be refunded: assign the payment to a lead first'
            : 'Several buyers have paid on this car: say which lead is being refunded',
          { leadIds: owed },
        );
      }
      leadId = owed[0];
    }
    const refundable = net.get(leadId) ?? 0;
    if (entry.amount.paise > refundable) {
      const paid = tallyPaid(tally, leadId);
      throw new BusinessRuleViolationError(
        'REFUND_ABOVE_PAID',
        'This refunds more than that buyer has paid on this car',
        {
          paid: paid / 100,
          refunded: (paid - refundable) / 100,
          requested: entry.amount.paise / 100,
          refundable: Math.max(refundable, 0) / 100,
        },
      );
    }
    entry.assignLead(leadId, now);
  }
}

/** What the lead has paid in total (net + refunded so far), read back from the tally. */
function tallyPaid(tally: VehicleMoneyTally, leadId: LeadId): number {
  return tally.paidBy(leadId);
}
