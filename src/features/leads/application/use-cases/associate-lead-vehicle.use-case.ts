import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { AssociateLeadVehicleCommand } from '../dtos/associate-lead-vehicle-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { toLeadId } from '../../domain/lead-id';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { ILiveVehicleLookup } from '../../domain/live-vehicle.port';

export class AssociateLeadVehicleUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicles: ILiveVehicleLookup,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: AssociateLeadVehicleCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly vehicleId: string }> {
    this.policy.requireAdmin(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }

    const vehicleId = toVehicleId(command.vehicleId);
    if (!(await this.vehicles.isLive(vehicleId))) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    lead.associateVehicle(vehicleId, this.clock.now());
    await this.repo.save(lead, null, null);
    return { vehicleId };
  }
}
