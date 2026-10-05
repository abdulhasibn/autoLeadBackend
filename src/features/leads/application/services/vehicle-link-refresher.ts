import type { UserId } from '../../../../domain/shared/user-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { IVehicleLinkSync } from '../../domain/vehicle-link-sync.port';

/** Recomputes a vehicle's open ⇄ linked state from its current active leads. */
export class VehicleLinkRefresher {
  constructor(
    private readonly repo: ILeadRepository,
    private readonly vehicleLinkSync: IVehicleLinkSync,
  ) {}

  async refresh(vehicleId: VehicleId, actorId: UserId): Promise<void> {
    const active = await this.repo.findActiveByVehicle(vehicleId);
    await this.vehicleLinkSync.syncLinkState(vehicleId, active.length > 0, actorId);
  }
}
