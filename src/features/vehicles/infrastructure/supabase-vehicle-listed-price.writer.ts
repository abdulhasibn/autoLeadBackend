import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { IVehicleListedPriceWriter } from '../domain/vehicle-listed-price.port';

export class SupabaseVehicleListedPriceWriter implements IVehicleListedPriceWriter {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async set(vehicleId: VehicleId, listedPrice: number | null): Promise<void> {
    // Upsert on vehicle_id touching only listed_price, so the rest of the row
    // (internal prices, finance payload) is left as it is.
    const { error } = await this.db
      .from('vehicle_financials')
      .upsert(
        { vehicle_id: vehicleId, listed_price: listedPrice, updated_at: new Date().toISOString() },
        { onConflict: 'vehicle_id' },
      );

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to set listed price: ${error.message}`);
    }
  }
}
