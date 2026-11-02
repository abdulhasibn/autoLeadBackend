import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toVehicleId, type VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
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
