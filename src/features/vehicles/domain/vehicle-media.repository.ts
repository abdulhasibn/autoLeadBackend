import type { MediaId } from './media-id';
import type { VehicleMedia } from './vehicle-media.entity';

export interface IVehicleMediaRepository {
  findById(id: MediaId): Promise<VehicleMedia | null>;
  save(media: VehicleMedia): Promise<void>;
  delete(id: MediaId): Promise<void>;
}
