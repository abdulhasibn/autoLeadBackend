import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { VehicleDto } from '../dtos/vehicle.dto';
import { SIGNED_READ_TTL_SECONDS, type ObjectStoragePort } from '../../domain/object-storage.port';
import type { IVehicleMediaQueries } from '../../domain/vehicle-media.queries';
import type { VehicleReadModel } from '../../domain/vehicle.queries';

/**
 * Attaches each vehicle's signed cover-photo URL. One media query and one
 * storage call per batch, however many vehicles are in it.
 */
export class VehicleFrontImages {
  constructor(
    private readonly media: IVehicleMediaQueries,
    private readonly storage: ObjectStoragePort,
    private readonly clock: Clock,
  ) {}

  async attach(vehicles: readonly VehicleReadModel[]): Promise<VehicleDto[]> {
    const paths = await this.media.findFrontImagePaths(
      vehicles.map((vehicle) => toVehicleId(vehicle.id)),
    );
    const urls = await this.storage.createSignedReadUrls({
      kind: 'media',
      storagePaths: [...new Set(paths.values())],
      expiresInSeconds: SIGNED_READ_TTL_SECONDS,
    });
    const expiresAt = new Date(
      this.clock.now().getTime() + SIGNED_READ_TTL_SECONDS * 1000,
    ).toISOString();

    return vehicles.map((vehicle) => {
      const path = paths.get(toVehicleId(vehicle.id));
      const url = path === undefined ? undefined : urls.get(path);
      return url === undefined
        ? { ...vehicle, frontImageUrl: null, frontImageUrlExpiresAt: null }
        : { ...vehicle, frontImageUrl: url, frontImageUrlExpiresAt: expiresAt };
    });
  }
}
