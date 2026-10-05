import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { ILeadQueries, LeadListCriteria, LeadReadModel } from '../domain/lead.queries';
import { toLeadReadModel, type LeadListRow } from './lead.mapper';

const LEAD_LIST_COLUMNS =
  'id, showroom_id, vehicle_id, assigned_to, contact_id, source, status, budget, preferred_vehicle, purchase_timeline, finance_required, current_vehicle, trade_in_required, notes, created_by, created_at, updated_at, deleted_at, contacts ( full_name, phone, email, deleted_at ), follow_ups ( id, task_type, scheduled_at, notes, completed_at, deleted_at )';

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
