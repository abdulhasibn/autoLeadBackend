import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { IVehicleDealQueries } from '../../domain/vehicle-deal.queries';

/**
 * Whether a car's sale price is recorded, as seen by other features
 * (ADR-0006). Reads the plaintext sale date, so it needs no unlocked vault.
 */
export class RecordedSaleLookup {
  constructor(private readonly deals: Pick<IVehicleDealQueries, 'find'>) {}

  async hasRecordedSale(vehicleId: VehicleId): Promise<boolean> {
    const deal = await this.deals.find(vehicleId);
    return (deal?.soldOn ?? null) !== null;
  }
}
