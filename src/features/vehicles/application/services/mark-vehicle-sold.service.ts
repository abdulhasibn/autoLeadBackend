import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { UserId } from '../../../../domain/shared/user-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IVehicleRepository } from '../../domain/vehicle.repository';
import { VehicleStatus } from '../../domain/vehicle-status.value-object';

/**
 * Records a sale closed elsewhere (a lead). Enforces the vehicle status graph
 * and is idempotent: an already-sold vehicle is left untouched.
 */
export class MarkVehicleSoldService {
  constructor(
    private readonly repo: IVehicleRepository,
    private readonly clock: Clock,
  ) {}

  async markSold(vehicleId: VehicleId, actorId: UserId, reason: string): Promise<void> {
    const vehicle = await this.repo.findById(vehicleId);
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleId}`);
    }
    if (vehicle.status.value === 'sold') {
      return;
    }
    vehicle.changeStatus(VehicleStatus.sold(), this.clock.now(), reason);
    await this.repo.save(vehicle, actorId);
  }
}
