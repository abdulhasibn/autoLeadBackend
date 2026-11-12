import type { UserId } from '../../../../domain/shared/user-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { ILeadRepository } from '../../domain/lead.repository';

/**
 * The leads that keep a vehicle linked, as seen by the vehicles feature when an
 * admin drops a vehicle. Unlinking is idempotent: a retry finds fewer leads.
 */
export class LeadLinkService {
  constructor(
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
  ) {}

  async countActive(vehicleId: VehicleId): Promise<number> {
    const active = await this.repo.findActiveByVehicle(vehicleId);
    return active.length;
  }

  /**
   * Releases the vehicle's active leads. A confirmed booking can't stand
   * without its car, so it becomes `vehicle_unavailable` (ready to re-match);
   * other leads keep their status and just lose the link.
   */
  async unlinkAll(vehicleId: VehicleId, actorId: UserId): Promise<void> {
    const active = await this.repo.findActiveByVehicle(vehicleId);
    const now = this.clock.now();
    for (const lead of active) {
      if (lead.status.value === 'booking_confirmed') {
        lead.markVehicleUnavailable(now);
      } else {
        lead.unlinkVehicle(now);
      }
      await this.repo.save(lead, { actorId, statusNotes: 'Car dropped' });
    }
  }
}
