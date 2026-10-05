import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { LeadId } from '../../../../domain/shared/lead-id';
import type { UserId } from '../../../../domain/shared/user-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

/**
 * Applies lead-driven changes to a vehicle: whether a lead may link to it,
 * the open ⇄ linked flip, and the sale. Every write is idempotent so lead
 * workflows can be retried safely (ADR-0006, ADR-0011).
 */
export class VehicleLeadLinkService {
  constructor(
    private readonly repo: IVehicleRepository,
    private readonly clock: Clock,
  ) {}

  async linkability(vehicleId: VehicleId): Promise<'linkable' | 'unavailable' | 'not_found'> {
    const vehicle = await this.repo.findById(vehicleId);
    if (vehicle === null) {
      return 'not_found';
    }
    return vehicle.isLinkable ? 'linkable' : 'unavailable';
  }

  async syncLinkState(
    vehicleId: VehicleId,
    hasActiveLeads: boolean,
    actorId: UserId,
  ): Promise<void> {
    const vehicle = await this.repo.findById(vehicleId);
    if (vehicle === null) {
      return;
    }
    const before = vehicle.status.value;
    vehicle.syncLinkState(hasActiveLeads, this.clock.now());
    if (vehicle.status.value !== before) {
      await this.repo.save(vehicle, actorId);
    }
  }

  async markSold(
    vehicleId: VehicleId,
    leadId: LeadId,
    actorId: UserId,
    reason: string,
  ): Promise<void> {
    const vehicle = await this.repo.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleId}`);
    }
    if (vehicle.status.value === 'sold' && vehicle.soldLeadId === leadId) {
      return;
    }
    const now = this.clock.now();
    // The converting lead is active on this vehicle, so heal a stale `open` first.
    vehicle.syncLinkState(true, now);
    vehicle.markSold(leadId, now, reason);
    await this.repo.save(vehicle, actorId);
  }
}
