import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import { toMediaId } from '../../domain/media-id';
import type { ObjectStoragePort } from '../../domain/object-storage.port';
import type { IVehicleMediaRepository } from '../../domain/vehicle-media.repository';
import type { IVehicleRepository } from '../../domain/vehicle.repository';

export class DeleteVehicleMediaUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly vehicles: IVehicleRepository,
    private readonly media: IVehicleMediaRepository,
    private readonly storage: ObjectStoragePort,
  ) {}

  async execute(
    vehicleIdRaw: string,
    mediaIdRaw: string,
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireAdmin(ctx);

    const vehicle = await this.vehicles.findById(toVehicleId(vehicleIdRaw));
    if (vehicle === null) {
      throw new NotFoundError(`Vehicle not found for id ${vehicleIdRaw}`);
    }

    const media = await this.media.findById(toMediaId(mediaIdRaw));
    if (media === null || media.vehicleId !== vehicle.id) {
      throw new NotFoundError(`Vehicle media not found for id ${mediaIdRaw}`);
    }

    await this.media.delete(media.id);
    await this.storage.remove('media', media.storagePath.value);
  }
}
