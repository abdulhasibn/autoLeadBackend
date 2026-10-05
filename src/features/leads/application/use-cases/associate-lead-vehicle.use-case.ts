import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { AssociateLeadVehicleCommand } from '../dtos/associate-lead-vehicle-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { requireLinkableVehicle } from '../services/require-linkable-vehicle';
import type { VehicleLinkRefresher } from '../services/vehicle-link-refresher';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { ILinkableVehicleLookup } from '../../domain/linkable-vehicle.port';

export class AssociateLeadVehicleUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicles: ILinkableVehicleLookup,
    private readonly vehicleLinks: VehicleLinkRefresher,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: AssociateLeadVehicleCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly vehicleId: string }> {
    this.policy.requireStaff(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const vehicleId = toVehicleId(command.vehicleId);
    const previousVehicleId = lead.vehicleId;
    if (previousVehicleId !== vehicleId) {
      await requireLinkableVehicle(this.vehicles, vehicleId);
    }

    lead.associateVehicle(vehicleId, this.clock.now());
    await this.repo.save(lead, { actorId: ctx.userId });

    await this.vehicleLinks.refresh(vehicleId, ctx.userId);
    if (previousVehicleId !== null && previousVehicleId !== vehicleId) {
      await this.vehicleLinks.refresh(previousVehicleId, ctx.userId);
    }
    return { vehicleId };
  }
}
