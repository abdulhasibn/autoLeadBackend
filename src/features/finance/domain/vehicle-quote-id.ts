import type { Brand } from '../../../shared/primitives/brand';

export type VehicleQuoteId = Brand<string, 'VehicleQuoteId'>;

export function toVehicleQuoteId(value: string): VehicleQuoteId {
  return value as VehicleQuoteId;
}
