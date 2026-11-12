import type { VehicleId } from '../../../domain/shared/vehicle-id';

/**
 * Whether finance has a sale price recorded for a vehicle (ADR-0006).
 * Undoing a conversion is refused while it does: the price goes first.
 */
export interface IRecordedSaleLookup {
  hasRecordedSale(vehicleId: VehicleId): Promise<boolean>;
}
