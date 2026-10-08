import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { anyColumnContains } from '../../../infrastructure/supabase/ilike-pattern';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type {
  IVehicleQueries,
  VehicleListCriteria,
  VehicleReadModel,
} from '../domain/vehicle.queries';
import { toVehicleReadModel, type VehicleListRow } from './vehicle.mapper';

// `vehicle_list` is `vehicles` joined to its variant, model and make, so search
// and catalog filters are plain column filters.
const VEHICLE_LIST_COLUMNS =
  'id, showroom_id, owner_id, variant_id, make_name, model_name, variant_name, year, registration_number, fuel_type, transmission, km_driven, num_previous_owners, colour, insurance_valid_until, rc_status, service_history, accident_history, loan_status, location, description, status, sold_lead_id, acquisition_type, submitted_by, created_at, updated_at, deleted_at';

const SEARCH_COLUMNS = ['registration_number', 'make_name', 'model_name', 'variant_name'];

export class SupabaseVehicleQueries implements IVehicleQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listVehicles(
    criteria: VehicleListCriteria,
    page: Pagination,
  ): Promise<Page<VehicleReadModel>> {
    let query = this.db
      .from('vehicle_list')
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
    if (criteria.search !== undefined) {
      for (const word of criteria.search.words) {
        query = query.or(anyColumnContains(SEARCH_COLUMNS, word));
      }
    }
    if (criteria.makeId !== undefined) {
      query = query.eq('make_id', criteria.makeId);
    }
    if (criteria.modelId !== undefined) {
      query = query.eq('model_id', criteria.modelId);
    }
    if (criteria.variantId !== undefined) {
      query = query.eq('variant_id', criteria.variantId);
    }
    if (criteria.yearMin !== undefined) {
      query = query.gte('year', criteria.yearMin);
    }
    if (criteria.yearMax !== undefined) {
      query = query.lte('year', criteria.yearMax);
    }
    if (criteria.kmMin !== undefined) {
      query = query.gte('km_driven', criteria.kmMin);
    }
    if (criteria.kmMax !== undefined) {
      query = query.lte('km_driven', criteria.kmMax);
    }
    if (criteria.fuelTypes !== undefined) {
      query = query.in('fuel_type', [...criteria.fuelTypes]);
    }
    if (criteria.transmissions !== undefined) {
      query = query.in('transmission', [...criteria.transmissions]);
    }

    const { data, error, count } = await query.range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
      throw new DatabaseUnavailableError(`Failed to list vehicles: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as VehicleListRow[])
      .map((row) => toVehicleReadModel(row))
      .filter((item): item is VehicleReadModel => item !== null);

    return toPage(items, count ?? items.length, page);
  }

  async getVehicle(id: VehicleId): Promise<VehicleReadModel | null> {
    const { data, error } = await this.db
      .from('vehicle_list')
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
