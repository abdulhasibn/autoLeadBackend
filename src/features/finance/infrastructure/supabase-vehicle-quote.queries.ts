import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { SealedVehicleQuote } from '../domain/sealed-finance-records';
import type { IVehicleQuoteQueries } from '../domain/vehicle-quote.queries';
import { VEHICLE_QUOTE_COLUMNS, toSealedVehicleQuote } from './vehicle-quote.mapper';

export class SupabaseVehicleQuoteQueries implements IVehicleQuoteQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listForVehicles(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleQuote[]> {
    if (vehicleIds.length === 0) {
      return [];
    }
    const { data, error } = await this.db
      .from('vehicle_quotes')
      .select(VEHICLE_QUOTE_COLUMNS)
      .in('vehicle_id', [...vehicleIds])
      .is('deleted_at', null);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list quotes: ${error.message}`);
    }
    return (data ?? []).map(toSealedVehicleQuote);
  }
}
