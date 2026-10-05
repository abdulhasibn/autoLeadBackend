import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  IVehicleQueries,
  VehicleListCriteria,
  VehicleReadModel,
} from '../domain/vehicle.queries';
import { toVehicleReadModel, type VehicleListRow } from './vehicle.mapper';

const VEHICLE_LIST_COLUMNS =
  'id, showroom_id, owner_id, variant_id, year, registration_number, fuel_type, transmission, km_driven, num_previous_owners, colour, insurance_valid_until, rc_status, service_history, accident_history, loan_status, location, description, status, sold_lead_id, acquisition_type, submitted_by, created_at, updated_at, deleted_at, variants ( name, models ( name, makes ( name ) ) )';

export class SupabaseVehicleQueries implements IVehicleQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listVehicles(
    criteria: VehicleListCriteria,
    page: Pagination,
  ): Promise<Page<VehicleReadModel>> {
    let query = this.db
      .from('vehicles')
      .select(VEHICLE_LIST_COLUMNS, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (criteria.status !== undefined) {
      query = query.eq('status', criteria.status);
    }
    if (criteria.ownerId !== undefined) {
      query = query.eq('owner_id', criteria.ownerId);
    }
    if (criteria.showroomId !== undefined) {
      query = query.eq('showroom_id', criteria.showroomId);
    }
    if (criteria.registration !== undefined) {
      query = query.eq('registration_number', criteria.registration);
    }

    const { data, error, count } = await query.range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list vehicles: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as VehicleListRow[])
      .map((row) => toVehicleReadModel(row))
      .filter((item): item is VehicleReadModel => item !== null);

    return toPage(items, count ?? items.length, page);
  }

  async getVehicle(id: VehicleId): Promise<VehicleReadModel | null> {
    const { data, error } = await this.db
      .from('vehicles')
      .select(VEHICLE_LIST_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toVehicleReadModel(data as unknown as VehicleListRow);
  }
}
