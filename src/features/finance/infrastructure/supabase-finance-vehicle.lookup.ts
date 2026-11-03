import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toVehicleId, type VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
  SoldVehicleFacts,
} from '../domain/finance-vehicle-lookup.port';

type VehicleListRow = Pick<
  Database['public']['Views']['vehicle_list']['Row'],
  'id' | 'showroom_id' | 'make_name' | 'model_name' | 'registration_number'
>;

const COLUMNS = 'id, showroom_id, make_name, model_name, registration_number';

/**
 * Reads car facts from the `vehicle_list` view for finance (ADR-0006
 * precedent: supabase-assignable-staff.lookup). No vehicles-feature import.
 */
export class SupabaseFinanceVehicleLookup implements IFinanceVehicleLookup {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findLinkable(id: VehicleId): Promise<FinanceVehicleFacts | null> {
    const { data, error } = await this.db
      .from('vehicle_list')
      .select(COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to look up vehicle: ${error.message}`);
    }
    return data === null ? null : toFacts(data);
  }

  async findMany(ids: readonly VehicleId[]): Promise<readonly FinanceVehicleFacts[]> {
    if (ids.length === 0) {
      return [];
    }
    const { data, error } = await this.db
      .from('vehicle_list')
      .select(COLUMNS)
      .in('id', [...ids]);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to look up vehicles: ${error.message}`);
    }
    return (data ?? []).flatMap((row) => {
      const facts = toFacts(row);
      return facts === null ? [] : [facts];
    });
  }

  async listSoldWithoutSale(): Promise<readonly SoldVehicleFacts[]> {
    const { data: sold, error } = await this.db
      .from('vehicle_list')
      .select(`${COLUMNS}, sold_lead_id, updated_at`)
      .eq('status', 'sold')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1000);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list sold vehicles: ${error.message}`);
    }
    const ids = (sold ?? []).flatMap((row) => (row.id === null ? [] : [row.id]));
    if (ids.length === 0) {
      return [];
    }
    const { data: priced, error: pricedError } = await this.db
      .from('vehicle_financials')
      .select('vehicle_id')
      .in('vehicle_id', ids)
      .not('sold_on', 'is', null);
    if (pricedError !== null) {
      throw new DatabaseUnavailableError(`Failed to check recorded sales: ${pricedError.message}`);
    }
    const recorded = new Set((priced ?? []).map((row) => row.vehicle_id));
    return (sold ?? []).flatMap((row) => {
      const facts = toFacts(row);
      if (facts === null || recorded.has(facts.id)) {
        return [];
      }
      return [
        { ...facts, soldLeadId: row.sold_lead_id === null ? null : toLeadId(row.sold_lead_id) },
      ];
    });
  }
}

function toFacts(row: VehicleListRow): FinanceVehicleFacts | null {
  if (row.id === null || row.showroom_id === null) {
    return null;
  }
  const name = [row.make_name, row.model_name].filter((part) => part !== null).join(' ');
  const label = [name, row.registration_number]
    .filter((part) => part !== null && part !== '')
    .join(' · ');
  return {
    id: toVehicleId(row.id),
    showroomId: toShowroomId(row.showroom_id),
    label: label.length === 0 ? 'Vehicle' : label,
  };
}
