import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { LeadId } from '../../../../domain/shared/lead-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { ChangeLeadStatusUseCase } from '../use-cases/change-lead-status.use-case';

/**
 * Converts the buyer's lead when finance records a car's sale, as seen by the
 * finance feature (ADR-0006). The conversion itself is the normal status
 * change, so the car is sold and its other leads freed exactly as if staff
 * had converted the lead from its page (ADR-0011).
 */
export class BookedLeadConversionService {
  constructor(
    private readonly repo: ILeadRepository,
    private readonly changeStatus: ChangeLeadStatusUseCase,
  ) {}

  async convertBookedLead(
    vehicleId: VehicleId,
    leadId: LeadId,
    ctx: AuthenticatedContext,
  ): Promise<void> {
    const lead = await this.repo.findById(leadId);
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${leadId}`);
    }
    if (lead.vehicleId !== vehicleId || lead.status.value !== 'booking_confirmed') {
      throw new BusinessRuleViolationError(
        'SALE_LEAD_NOT_BOOKED',
        'The buyer’s lead must be linked to this car with its booking confirmed',
      );
    }
    await this.changeStatus.execute(
      { leadId, status: 'converted', notes: 'Sale recorded in finance' },
      ctx,
    );
  }
}
