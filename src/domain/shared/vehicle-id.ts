import type { Brand } from '../../shared/primitives/brand';

export type VehicleId = Brand<string, 'VehicleId'>;

export function toVehicleId(value: string): VehicleId {
  return value as VehicleId;
}
