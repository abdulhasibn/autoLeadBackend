import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { IPublicMediaSigner } from '../../domain/public-media-signer.port';
import type { IPublicVehicleQueries } from '../../domain/public-vehicle.queries';
import { toPublicVehicleSummary, type PublicVehicleDetailDto } from '../dtos/public-vehicle.dto';

export class GetPublicVehicleUseCase {
  constructor(
    private readonly queries: IPublicVehicleQueries,
    private readonly signer: IPublicMediaSigner,
  ) {}

  /** Sold, dropped and removed vehicles are indistinguishable from unknown ids. */
  async execute(id: string): Promise<PublicVehicleDetailDto> {
    const vehicle = await this.queries.get(id);
    if (vehicle === null) {
      throw new NotFoundError('Vehicle not found');
    }

    const photos = await this.queries.photos(id);
    const urls = await this.signer.sign(photos.map((photo) => photo.storagePath));
    const signed = photos.flatMap((photo) => {
      const url = urls.get(photo.storagePath);
      return url === undefined ? [] : [{ url, category: photo.category }];
    });
    const cover = signed.find((photo) => photo.category === 'front') ?? signed[0];

    return {
      ...toPublicVehicleSummary(vehicle, cover?.url ?? null),
      description: vehicle.description,
      photos: signed,
    };
  }
}
