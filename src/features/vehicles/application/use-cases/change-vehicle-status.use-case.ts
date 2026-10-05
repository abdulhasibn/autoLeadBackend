import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { ChangeVehicleStatusCommand } from '../dtos/change-vehicle-status-command';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { ILinkedLeads } from '../../domain/linked-leads.port';
import type { IVehicleRepository } from '../../domain/vehicle.repository';
import { VehicleStatus } from '../../domain/vehicle-status.value-object';

export class ChangeVehicleStatusUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly repo: IVehicleRepository,
    private readonly linkedLeads: ILinkedLeads,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ChangeVehicleStatusCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string; readonly unlinkedLeadCount: number }> {
    this.policy.requireAdmin(ctx);

    const vehicleId = toVehicleId(command.vehicleId);
    const vehicle = await this.repo.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    const next = VehicleStatus.create(command.status);
    // Validate before touching any lead.
    vehicle.changeStatusByAdmin(next, this.clock.now(), command.reason);

    let unlinkedLeadCount = 0;
    if (next.value === 'dropped') {
      unlinkedLeadCount = await this.linkedLeads.countActive(vehicleId);
      if (unlinkedLeadCount > 0 && !command.confirmUnlinkLeads) {
        throw new BusinessRuleViolationError(
          'VEHICLE_HAS_LINKED_LEADS',
          `${unlinkedLeadCount} active lead(s) are linked to this vehicle. Resend with confirmUnlinkLeads to drop it and unlink them`,
          { linkedLeadCount: unlinkedLeadCount },
        );
      }
      // Leads first: a retry after a failed vehicle save finds nothing left to unlink.
      if (unlinkedLeadCount > 0) {
        await this.linkedLeads.unlinkAll(vehicleId, ctx.userId);
      }
    }

    await this.repo.save(vehicle, ctx.userId);
    return { status: vehicle.status.value, unlinkedLeadCount };
  }
}
