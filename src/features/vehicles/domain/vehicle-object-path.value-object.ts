import type { VehicleId } from '../../../domain/shared/vehicle-id';
import { InvalidVehicleObjectPathError } from './errors/invalid-vehicle-object-path.error';

const OBJECT_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/i;

export class VehicleObjectPath {
  private constructor(readonly value: string) {}

  static create(vehicleId: VehicleId, path: string): VehicleObjectPath {
    const trimmed = path.trim();
    const prefix = `${vehicleId}/`;
    if (!trimmed.startsWith(prefix)) {
      throw new InvalidVehicleObjectPathError();
    }
    const name = trimmed.slice(prefix.length);
    if (!OBJECT_NAME.test(name)) {
      throw new InvalidVehicleObjectPathError('Invalid storage path');
    }
    return new VehicleObjectPath(trimmed);
  }

  static compose(vehicleId: VehicleId, objectId: string, extension: string): VehicleObjectPath {
    return new VehicleObjectPath(`${vehicleId}/${objectId}.${extension}`);
  }
}
