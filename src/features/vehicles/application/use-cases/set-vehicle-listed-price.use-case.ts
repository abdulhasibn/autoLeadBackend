import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { IVehicleListedPriceWriter } from '../../domain/vehicle-listed-price.port';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

/** Sets or clears the public asking price. Pricing is an admin decision. */
export class SetVehicleListedPriceUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly repo: IVehicleRepository,
    private readonly writer: IVehicleListedPriceWriter,
  ) {}

  async execute(
    vehicleIdRaw: string,
    listedPrice: number | null,
    ctx: AuthenticatedContext,
  ): Promise<{ listedPrice: number | null }> {
    this.policy.requireAdmin(ctx);

    const vehicleId = toVehicleId(vehicleIdRaw);
    if ((await this.repo.findById(vehicleId)) === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    await this.writer.set(vehicleId, listedPrice);
    return { listedPrice };
  }
}
