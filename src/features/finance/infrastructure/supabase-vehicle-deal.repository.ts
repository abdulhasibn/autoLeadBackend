import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { SealedVehicleDeal } from '../domain/sealed-finance-records';
import type { IVehicleDealRepository } from '../domain/vehicle-deal.repository';
import { translateFinanceWriteError } from './translate-finance-write-error';
import { VEHICLE_DEAL_COLUMNS, toSealedVehicleDeal, toVehicleDealRow } from './vehicle-deal.mapper';

export class SupabaseVehicleDealRepository implements IVehicleDealRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async find(vehicleId: VehicleId): Promise<SealedVehicleDeal | null> {
    const { data, error } = await this.db
      .from('vehicle_financials')
      .select(VEHICLE_DEAL_COLUMNS)
      .eq('vehicle_id', vehicleId)
      .maybeSingle();
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle deal: ${error.message}`);
    }
    return data === null ? null : toSealedVehicleDeal(data);
  }

  async save(deal: SealedVehicleDeal): Promise<void> {
    const { error } = await this.db
      .from('vehicle_financials')
      .upsert(toVehicleDealRow(deal), { onConflict: 'vehicle_id' });
    if (error !== null) {
      translateFinanceWriteError(error, 'Failed to save vehicle deal');
    }
  }
}
