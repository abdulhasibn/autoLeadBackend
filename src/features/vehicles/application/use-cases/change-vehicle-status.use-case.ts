import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { ChangeVehicleStatusCommand } from '../dtos/change-vehicle-status-command';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { IVehicleRepository } from '../../domain/vehicle.repository';
import { VehicleStatus } from '../../domain/vehicle-status.value-object';

export class ChangeVehicleStatusUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly repo: IVehicleRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ChangeVehicleStatusCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string }> {
    this.policy.requireAdmin(ctx);

    const vehicle = await this.repo.findById(toVehicleId(command.vehicleId));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${command.vehicleId}`);
    }

    vehicle.changeStatus(VehicleStatus.create(command.status), this.clock.now(), command.reason);
    await this.repo.save(vehicle, ctx.userId);
    return { status: vehicle.status.value };
  }
}
