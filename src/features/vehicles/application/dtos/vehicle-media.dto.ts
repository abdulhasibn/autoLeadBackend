import type { VehicleMediaReadModel } from '../../domain/vehicle-media.queries';

export interface VehicleMediaDto extends VehicleMediaReadModel {
  readonly url: string;
  readonly urlExpiresAt: string;
}
