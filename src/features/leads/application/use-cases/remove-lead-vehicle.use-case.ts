import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { VehicleLinkRefresher } from '../services/vehicle-link-refresher';
import type { ILeadRepository } from '../../domain/lead.repository';

/** Clears an open lead's vehicle; the vehicle re-opens once no active lead holds it. */
export class RemoveLeadVehicleUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly vehicleLinks: VehicleLinkRefresher,
    private readonly clock: Clock,
  ) {}

  async execute(
    leadIdRaw: string,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly vehicleId: null }> {
    this.policy.requireStaff(ctx);

    const lead = await this.repo.findById(toLeadId(leadIdRaw));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${leadIdRaw}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const previousVehicleId = lead.vehicleId;
    lead.removeVehicle(this.clock.now());
    if (previousVehicleId !== null) {
      await this.repo.save(lead, { actorId: ctx.userId });
      await this.vehicleLinks.refresh(previousVehicleId, ctx.userId);
    }
    return { vehicleId: null };
  }
}
