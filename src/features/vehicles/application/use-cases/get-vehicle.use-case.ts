import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { VehicleDto } from '../dtos/vehicle.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { IVehicleQueries } from '../../domain/vehicle.queries';

export class GetVehicleUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: IVehicleQueries,
  ) {}

  async execute(vehicleIdRaw: string, ctx: AuthenticatedContext): Promise<VehicleDto> {
    this.policy.requireStaff(ctx);

    const vehicle = await this.queries.getVehicle(toVehicleId(vehicleIdRaw));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    return vehicle;
  }
}
