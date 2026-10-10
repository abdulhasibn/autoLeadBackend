import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { anyColumnContains } from '../../../infrastructure/supabase/ilike-pattern';
import { emptyPageIfPastEnd } from '../../../infrastructure/supabase/range-not-satisfiable';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { LeadId } from '../../../domain/shared/lead-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { ACTIVE_LEAD_STATUSES, MATCHABLE_LEAD_STATUSES } from '../domain/lead-status.value-object';
import type {
  ILeadQueries,
  LeadListCriteria,
  LeadMatchCandidateCriteria,
  LeadMatchCandidates,
  LeadReadModel,
} from '../domain/lead.queries';
import { toLeadReadModel, type LeadListRow } from './lead.mapper';

// FK hints are required: vehicles.sold_lead_id also links vehicles and leads,
// and makes/models/variants are reachable both directly and via the vehicle.
const LEAD_LIST_COLUMNS = [
  'id, showroom_id, vehicle_id, assigned_to, contact_id, source, status, budget',
  'preferred_vehicle, preferred_make_id, preferred_model_id, preferred_variant_id',
  'preferred_colours, preferred_fuel_types, preferred_transmissions, preferred_body_types, preferred_year_min, preferred_year_max, preferred_km_max, preferred_max_owners',
  'purchase_timeline, finance_required, current_vehicle, trade_in_required, notes',
  'created_by, created_at, updated_at, deleted_at',
  'contacts ( full_name, phone, email, deleted_at )',
  'assignee:users!assigned_to ( full_name )',
  'follow_ups ( id, task_type, scheduled_at, notes, completed_at, deleted_at )',
  'linked_vehicle:vehicles!vehicle_id ( id, year, registration_number, deleted_at, variants ( name, models ( name, makes ( name ) ) ) )',
  'preferred_make:makes!preferred_make_id ( name )',
  'preferred_model:models!preferred_model_id ( name )',
  'preferred_variant:variants!preferred_variant_id ( name )',
].join(', ');

// A lead with any of these set has a preference worth scoring.
const HAS_PREFERENCE = [
  'preferred_make_id.not.is.null',
  'budget.not.is.null',
  'preferred_year_min.not.is.null',
  'preferred_year_max.not.is.null',
  'preferred_km_max.not.is.null',
  'preferred_max_owners.not.is.null',
  'preferred_colours.neq.{}',
  'preferred_fuel_types.neq.{}',
  'preferred_transmissions.neq.{}',
  'preferred_body_types.neq.{}',
].join(',');

export class SupabaseLeadQueries implements ILeadQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listLeads(criteria: LeadListCriteria, page: Pagination): Promise<Page<LeadReadModel>> {
    // A contact search must drop non-matching leads, so the contact embed turns inner.
    const columns =
      criteria.search === undefined
        ? LEAD_LIST_COLUMNS
        : LEAD_LIST_COLUMNS.replace('contacts (', 'contacts!inner (');
    let query = this.db
      .from('leads')
      .select(columns, { count: 'exact' })
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

    if (criteria.search !== undefined) {
      query = query.or(anyColumnContains(['full_name', 'phone'], criteria.search), {
        referencedTable: 'contacts',
      });
    }
    if (criteria.budgetMin !== undefined) {
      query = query.gte('budget', criteria.budgetMin);
    }
    if (criteria.budgetMax !== undefined) {
      query = query.lte('budget', criteria.budgetMax);
    }
    if (criteria.sources !== undefined) {
      query = query.in('source', [...criteria.sources]);
    }
    if (criteria.hasVehicle !== undefined) {
      query = criteria.hasVehicle
        ? query.not('vehicle_id', 'is', null)
        : query.is('vehicle_id', null);
    }
    if (criteria.purchaseTimeline !== undefined) {
      query = query.eq('purchase_timeline', criteria.purchaseTimeline);
    }
    if (criteria.financeRequired !== undefined) {
      query = query.eq('finance_required', criteria.financeRequired);
    }
    if (criteria.createdFrom !== undefined) {
      query = query.gte('created_at', criteria.createdFrom.toISOString());
    }
    if (criteria.createdTo !== undefined) {
      query = query.lt('created_at', criteria.createdTo.toISOString());
    }

    const { data, error, count } = await query.range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      const pastEnd = emptyPageIfPastEnd(error, page);
      if (pastEnd !== null) {
        return pastEnd;
      }
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

  async countActiveByVehicles(
    vehicleIds: readonly VehicleId[],
  ): Promise<ReadonlyMap<VehicleId, number>> {
    const counts = new Map<VehicleId, number>();
    if (vehicleIds.length === 0) {
      return counts;
    }

    const { data, error } = await this.db
      .from('leads')
      .select('vehicle_id')
      .in('vehicle_id', [...new Set(vehicleIds)])
      .in('status', [...ACTIVE_LEAD_STATUSES])
      .is('deleted_at', null);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to count linked leads: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (row.vehicle_id !== null) {
        const vehicleId = toVehicleId(row.vehicle_id);
        counts.set(vehicleId, (counts.get(vehicleId) ?? 0) + 1);
      }
    }
    return counts;
  }

  async listMatchCandidates(criteria: LeadMatchCandidateCriteria): Promise<LeadMatchCandidates> {
    let linkedQuery = this.db
      .from('leads')
      .select(LEAD_LIST_COLUMNS)
      .eq('vehicle_id', criteria.vehicleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    let unlinkedQuery = this.db
      .from('leads')
      .select(LEAD_LIST_COLUMNS)
      .is('vehicle_id', null)
      .eq('showroom_id', criteria.showroomId)
      .in('status', [...MATCHABLE_LEAD_STATUSES])
      .or(HAS_PREFERENCE)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(criteria.limit + 1);
    if (criteria.assignedTo !== undefined) {
      linkedQuery = linkedQuery.eq('assigned_to', criteria.assignedTo);
      unlinkedQuery = unlinkedQuery.eq('assigned_to', criteria.assignedTo);
    }

    const [linked, unlinked] = await Promise.all([linkedQuery, unlinkedQuery]);
    if (linked.error !== null) {
      throw new DatabaseUnavailableError(`Failed to load linked leads: ${linked.error.message}`);
    }
    if (unlinked.error !== null) {
      throw new DatabaseUnavailableError(
        `Failed to load lead match candidates: ${unlinked.error.message}`,
      );
    }

    const unlinkedRows = (unlinked.data ?? []) as unknown as LeadListRow[];
    return {
      linked: toReadModels((linked.data ?? []) as unknown as LeadListRow[]),
      unlinked: toReadModels(unlinkedRows.slice(0, criteria.limit)),
      truncated: unlinkedRows.length > criteria.limit,
    };
  }
}

function toReadModels(rows: readonly LeadListRow[]): LeadReadModel[] {
  return rows
    .map((row) => toLeadReadModel(row))
    .filter((item): item is LeadReadModel => item !== null);
}
