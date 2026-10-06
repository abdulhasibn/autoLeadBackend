import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { ILeadQueries, LeadListCriteria, LeadReadModel } from '../domain/lead.queries';
import { toLeadReadModel, type LeadListRow } from './lead.mapper';

// FK hints are required: vehicles.sold_lead_id also links vehicles and leads,
// and makes/models/variants are reachable both directly and via the vehicle.
const LEAD_LIST_COLUMNS = [
  'id, showroom_id, vehicle_id, assigned_to, contact_id, source, status, budget',
  'preferred_vehicle, preferred_make_id, preferred_model_id, preferred_variant_id',
  'purchase_timeline, finance_required, current_vehicle, trade_in_required, notes',
  'created_by, created_at, updated_at, deleted_at',
  'contacts ( full_name, phone, email, deleted_at )',
  'follow_ups ( id, task_type, scheduled_at, notes, completed_at, deleted_at )',
  'linked_vehicle:vehicles!vehicle_id ( id, year, registration_number, deleted_at, variants ( name, models ( name, makes ( name ) ) ) )',
  'preferred_make:makes!preferred_make_id ( name )',
  'preferred_model:models!preferred_model_id ( name )',
  'preferred_variant:variants!preferred_variant_id ( name )',
].join(', ');

export class SupabaseLeadQueries implements ILeadQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listLeads(criteria: LeadListCriteria, page: Pagination): Promise<Page<LeadReadModel>> {
    let query = this.db
      .from('leads')
      .select(LEAD_LIST_COLUMNS, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (criteria.status !== undefined) {
      query = query.eq('status', criteria.status);
    }
    if (criteria.vehicleId !== undefined) {
      query = query.eq('vehicle_id', criteria.vehicleId);
    }
    if (criteria.assignedTo !== undefined) {
      query = query.eq('assigned_to', criteria.assignedTo);
    }
    if (criteria.preferredMakeId !== undefined) {
      query = query.eq('preferred_make_id', criteria.preferredMakeId);
    }
    if (criteria.preferredModelId !== undefined) {
      query = query.eq('preferred_model_id', criteria.preferredModelId);
    }
    if (criteria.preferredVariantId !== undefined) {
      query = query.eq('preferred_variant_id', criteria.preferredVariantId);
    }

    const { data, error, count } = await query.range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list leads: ${error.message}`);
    }

    const items = ((data ?? []) as unknown as LeadListRow[])
      .map((row) => toLeadReadModel(row))
      .filter((item): item is LeadReadModel => item !== null);

    return toPage(items, count ?? items.length, page);
  }

  async getLead(id: LeadId): Promise<LeadReadModel | null> {
    const { data, error } = await this.db
      .from('leads')
      .select(LEAD_LIST_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load lead: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toLeadReadModel(data as unknown as LeadListRow);
  }
}
