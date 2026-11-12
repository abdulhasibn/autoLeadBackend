import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';

/**
 * Closes the CRM side of a sale recorded in finance (ADR-0006): converts the
 * buyer's booking-confirmed lead, which marks the car sold and frees the
 * car's other leads (ADR-0011). Implemented by the leads feature.
 */
export interface IFinanceLeadConversion {
  /**
   * Converts `leadId`, which must be linked to `vehicleId` with its booking
   * confirmed. Throws a BusinessRuleViolationError otherwise.
   */
  convertBookedLead(vehicleId: VehicleId, leadId: LeadId, ctx: AuthenticatedContext): Promise<void>;
}
