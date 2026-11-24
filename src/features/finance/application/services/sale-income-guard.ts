import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import type { LeadId } from '../../../../domain/shared/lead-id';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';

export interface SaleLeadRequest {
  /** The lead the request names; undefined/null = work it out. */
  readonly leadId?: LeadId | null;
  /**
   * The entry moved to this car and keeps its lead (§4.3): a lead whose lead
   * is on the target car, in any active status, is accepted too.
   */
  readonly accepts?: 'current-buyers' | 'on-car';
}

/**
 * Money from a buyer (income with purpose `sale`) belongs to the lead who paid
 * (BE-77 §4.2). Writing one resolves that lead:
 * - the car is sold: the sold lead (no sold lead: the money stays unassigned,
 *   counted as the buyer's as before);
 * - otherwise one of the leads with a confirmed booking on the car. With none
 *   the payment is refused (`SALE_NOT_RECORDED`, #32); with several the request
 *   must say which (`SALE_LEAD_REQUIRED`); a lead that isn't a current buyer is
 *   refused (`SALE_LEAD_NOT_ON_CAR`).
 */
export class SaleIncomeGuard {
  constructor(
    private readonly leads: Pick<IFinanceLeadLookup, 'listBookedForVehicle' | 'findMany'>,
  ) {}

  /** Sets the entry's lead if it is a car-linked `sale` income; otherwise does nothing. */
  async attribute(
    entry: FinanceEntry,
    vehicle: FinanceVehicleFacts | null,
    request: SaleLeadRequest,
    now: Date,
  ): Promise<void> {
    if (entry.kind !== 'income' || entry.purpose !== 'sale' || vehicle === null) {
      return;
    }
    entry.assignLead(await this.resolve(vehicle, request), now);
  }

  /** The lead a new `sale` payment on this car goes to. Null only for a sold car with no sold lead. */
  async resolve(vehicle: FinanceVehicleFacts, request: SaleLeadRequest): Promise<LeadId | null> {
    const requested = request.leadId ?? null;
    if (vehicle.status === 'sold') {
      if (vehicle.soldLeadId === null) {
        return requested;
      }
      if (requested !== null && requested !== vehicle.soldLeadId) {
        await this.assertAccepted(requested, vehicle, request);
      }
      return requested ?? vehicle.soldLeadId;
    }
    const booked = (await this.leads.listBookedForVehicle(vehicle.id)).map((l) => l.id);
    if (requested !== null) {
      if (!booked.includes(requested)) await this.assertAccepted(requested, vehicle, request);
      return requested;
    }
    if (booked.length === 0) {
      throw new BusinessRuleViolationError(
        'SALE_NOT_RECORDED',
        'This car has no buyer yet: confirm a booking or record the sale before taking a payment from the buyer, or record it as other income',
      );
    }
    if (booked.length > 1) {
      throw new BusinessRuleViolationError(
        'SALE_LEAD_REQUIRED',
        'Several buyers have booked this car: say which lead paid',
        { bookedLeadIds: booked },
      );
    }
    return booked[0] ?? null;
  }

  /** A lead nobody has booked is accepted only after a move (its lead is on the target car). */
  private async assertAccepted(
    leadId: LeadId,
    vehicle: FinanceVehicleFacts,
    request: SaleLeadRequest,
  ): Promise<void> {
    if (request.accepts === 'on-car') {
      const [lead] = await this.leads.findMany([leadId]);
      if (lead !== undefined && lead.vehicleId === vehicle.id) return;
    }
    throw notOnCar(leadId);
  }

  /** PATCH of the lead alone: any existing lead (deleted ones too). */
  async assertLeadExists(leadId: LeadId): Promise<void> {
    const [lead] = await this.leads.findMany([leadId]);
    if (lead === undefined) throw notOnCar(leadId);
  }
}

function notOnCar(leadId: LeadId): BusinessRuleViolationError {
  return new BusinessRuleViolationError(
    'SALE_LEAD_NOT_ON_CAR',
    'That lead is not a buyer of this car',
    { leadId },
  );
}
