import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { ChangeLeadStatusCommand } from '../dtos/change-lead-status-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { toLeadId } from '../../domain/lead-id';
import type { ILeadRepository } from '../../domain/lead.repository';
import { LeadStatus } from '../../domain/lead-status.value-object';
import type { IVehicleSale } from '../../domain/vehicle-sale.port';

export class ChangeLeadStatusUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicleSale: IVehicleSale,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ChangeLeadStatusCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string; readonly vehicleMarkedSold: boolean }> {
    this.policy.requireStaff(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const next = LeadStatus.create(command.status);
    if (command.markVehicleSold && next.value !== 'sold') {
      throw new BusinessRuleViolationError(
        'MARK_VEHICLE_SOLD_REQUIRES_SOLD',
        'markVehicleSold can only be used when status is sold',
      );
    }
    const soldVehicleId = command.markVehicleSold ? lead.vehicleId : null;
    if (command.markVehicleSold && soldVehicleId === null) {
      throw new BusinessRuleViolationError(
        'LEAD_HAS_NO_VEHICLE',
        'Link a vehicle to this lead before marking it sold',
      );
    }

    lead.changeStatus(next, this.clock.now());
    // Vehicle first: it validates its own graph before writing, and a repeat
    // call is a no-op once it is sold, so a failed lead write can be retried.
    if (soldVehicleId !== null) {
      await this.vehicleSale.markSold(soldVehicleId, ctx.userId, `Sold through lead ${lead.id}`);
    }
    await this.repo.save(lead, { actorId: ctx.userId, statusNotes: command.notes });
    return { status: lead.status.value, vehicleMarkedSold: soldVehicleId !== null };
  }
}
