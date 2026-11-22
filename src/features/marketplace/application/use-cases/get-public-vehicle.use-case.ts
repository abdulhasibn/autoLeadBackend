import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { IPublicMediaSigner } from '../../domain/public-media-signer.port';
import type { IPublicVehicleQueries } from '../../domain/public-vehicle.queries';
import { toPublicVehicleSummary, type PublicVehicleDetailDto } from '../dtos/public-vehicle.dto';

export class GetPublicVehicleUseCase {
  constructor(
    private readonly queries: IPublicVehicleQueries,
    private readonly signer: IPublicMediaSigner,
  ) {}

  /**
   * Available cars and cars sold within the public window (`status: 'sold'`)
   * return normally. Dropped, removed, long-sold and unknown ids are
   * indistinguishable: all 404.
   */
  async execute(id: string): Promise<PublicVehicleDetailDto> {
    const found = await this.queries.get(id);
    if (found === null) {
      throw new NotFoundError('Vehicle not found');
    }

    const { vehicle, photos } = found;
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
      insuranceValidUntil: vehicle.insuranceNil ? null : vehicle.insuranceValidUntil,
      insuranceNil: vehicle.insuranceNil,
      rcStatus: vehicle.rcStatus,
      serviceHistory: vehicle.serviceHistory,
      accidentHistory: vehicle.accidentHistory,
    };
  }
}
