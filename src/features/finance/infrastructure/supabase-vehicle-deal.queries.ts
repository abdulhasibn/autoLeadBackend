import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { SealedVehicleDeal } from '../domain/sealed-finance-records';
import type { IVehicleDealQueries } from '../domain/vehicle-deal.queries';
import { inBatches } from './in-batches';
import { VEHICLE_DEAL_COLUMNS, toSealedVehicleDeal } from './vehicle-deal.mapper';

export class SupabaseVehicleDealQueries implements IVehicleDealQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async find(vehicleId: VehicleId): Promise<SealedVehicleDeal | null> {
    const [deal] = await this.findMany([vehicleId]);
    return deal ?? null;
  }

  async findMany(vehicleIds: readonly VehicleId[]): Promise<readonly SealedVehicleDeal[]> {
    const deals: SealedVehicleDeal[] = [];
    for (const batch of inBatches([...new Set(vehicleIds)])) {
      const { data, error } = await this.db
        .from('vehicle_financials')
        .select(VEHICLE_DEAL_COLUMNS)
        .in('vehicle_id', batch);
      if (error !== null) {
        throw new DatabaseUnavailableError(`Failed to load vehicle deals: ${error.message}`);
      }
      deals.push(...(data ?? []).map(toSealedVehicleDeal));
    }
    return deals;
  }

  async findSoldBetween(from: string, to: string): Promise<readonly SealedVehicleDeal[]> {
    const { data, error } = await this.db
      .from('vehicle_financials')
      .select(VEHICLE_DEAL_COLUMNS)
      .gte('sold_on', from)
      .lte('sold_on', to);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load sold vehicle deals: ${error.message}`);
    }
    return (data ?? []).map(toSealedVehicleDeal);
  }

  async findWithData(): Promise<readonly SealedVehicleDeal[]> {
    const { data, error } = await this.db
      .from('vehicle_financials')
      .select(VEHICLE_DEAL_COLUMNS)
      .or('payload.not.is.null,sold_on.not.is.null');
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle deals: ${error.message}`);
    }
    return (data ?? []).map(toSealedVehicleDeal);
  }
}
