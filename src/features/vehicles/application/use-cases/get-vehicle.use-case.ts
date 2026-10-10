import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { VehicleDto } from '../dtos/vehicle.dto';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { VehicleFrontImages } from '../services/vehicle-front-images';
import type { ILinkedLeadCounts } from '../../domain/linked-lead-counts.port';
import type { IVehicleQueries } from '../../domain/vehicle.queries';

export class GetVehicleUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: IVehicleQueries,
    private readonly frontImages: VehicleFrontImages,
    private readonly leadCounts: ILinkedLeadCounts,
  ) {}

  async execute(vehicleIdRaw: string, ctx: AuthenticatedContext): Promise<VehicleDto> {
    this.policy.requireStaff(ctx);

    const vehicle = await this.queries.getVehicle(toVehicleId(vehicleIdRaw));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    const vehicleId = toVehicleId(vehicle.id);
    const [[withImage], leadCounts] = await Promise.all([
      this.frontImages.attach([vehicle]),
      this.leadCounts.countActiveByVehicles([vehicleId]),
    ]);
    return {
      ...(withImage ?? { ...vehicle, frontImageUrl: null, frontImageUrlExpiresAt: null }),
      linkedLeadCount: leadCounts.get(vehicleId) ?? 0,
    };
  }
}
