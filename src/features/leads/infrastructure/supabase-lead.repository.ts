import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { Phone } from '../../../domain/shared/phone.value-object';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Contact } from '../domain/contact.entity';
import type { ContactId } from '../domain/contact-id';
import type { FollowUp } from '../domain/follow-up.entity';
import type { Lead } from '../domain/lead.entity';
import { ACTIVE_LEAD_STATUSES } from '../domain/lead-status.value-object';
import type { ILeadRepository, LeadWrite } from '../domain/lead.repository';
import { toContact, toLead, type ContactRow, type LeadRow } from './lead.mapper';
import { translateLeadWriteError } from './translate-lead-write-error';

const LEAD_COLUMNS =
  'id, showroom_id, vehicle_id, assigned_to, contact_id, source, status, budget, preferred_vehicle, preferred_make_id, preferred_model_id, preferred_variant_id, preferred_colours, preferred_fuel_types, preferred_transmissions, preferred_body_types, preferred_year_min, preferred_year_max, preferred_km_max, preferred_max_owners, purchase_timeline, finance_required, current_vehicle, trade_in_required, notes, created_by, created_at, updated_at, deleted_at';

const CONTACT_COLUMNS =
  'id, full_name, phone, email, created_by, created_at, updated_at, deleted_at';

export class SupabaseLeadRepository implements ILeadRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: LeadId): Promise<Lead | null> {
    const { data, error } = await this.db
      .from('leads')
      .select(LEAD_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load lead: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toLead(data as LeadRow);
  }

  async findActiveByVehicle(vehicleId: VehicleId): Promise<Lead[]> {
    const { data, error } = await this.db
      .from('leads')
      .select(LEAD_COLUMNS)
      .eq('vehicle_id', vehicleId)
      .in('status', [...ACTIVE_LEAD_STATUSES])
      .is('deleted_at', null);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load vehicle leads: ${error.message}`);
    }

    return (data as LeadRow[]).map(toLead);
  }

  async findContactById(id: ContactId): Promise<Contact | null> {
    const { data, error } = await this.db
      .from('contacts')
      .select(CONTACT_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load contact: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toContact(data as ContactRow);
  }

  async findLiveContactByPhone(phone: Phone): Promise<Contact | null> {
    const { data, error } = await this.db
      .from('contacts')
      .select(CONTACT_COLUMNS)
      .eq('phone', phone.value)
      .is('deleted_at', null)
      .is('merged_into_user_id', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load contact: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toContact(data as ContactRow);
  }

  async save(lead: Lead, write: LeadWrite): Promise<void> {
    const contact = write.contact ?? null;
    const { error } = await this.db.rpc('save_lead', {
      p_id: lead.id,
      p_showroom_id: lead.showroomId,
      p_vehicle_id: lead.vehicleId,
      p_contact_id: contact === null ? lead.contactId : contact.id,
      p_contact_full_name: contact === null ? null : contact.fullName,
      p_contact_phone: contact === null ? null : contact.phone.value,
      p_contact_email:
        contact === null ? null : contact.email === null ? null : contact.email.value,
      p_contact_created_by: contact === null ? null : contact.createdBy,
      p_source: lead.source.value,
      p_status: lead.status.value,
      p_budget: lead.budget,
      p_preferred_vehicle: lead.preferredVehicle,
      p_purchase_timeline: lead.purchaseTimeline,
      p_finance_required: lead.financeRequired,
      p_current_vehicle: lead.currentVehicle,
      p_trade_in_required: lead.tradeInRequired,
      p_notes: lead.notes,
      p_created_by: lead.createdBy,
      p_deleted_at: lead.deletedAt === null ? null : lead.deletedAt.toISOString(),
      p_write_history: lead.hasStatusChanged,
      p_status_notes: write.statusNotes ?? null,
      p_assigned_to: lead.assignedTo,
      p_update_assignee: lead.hasAssigneeChanged,
      p_actor_id: write.actorId,
      p_preferred_make_id: lead.preferredCatalog.makeId,
      p_preferred_model_id: lead.preferredCatalog.modelId,
      p_preferred_variant_id: lead.preferredCatalog.variantId,
      p_preferred_colours: [...lead.preference.colours],
      p_preferred_fuel_types: [...lead.preference.fuelTypes],
      p_preferred_transmissions: [...lead.preference.transmissions],
      p_preferred_body_types: [...lead.preference.bodyTypes],
      p_preferred_year_min: lead.preference.yearMin,
      p_preferred_year_max: lead.preference.yearMax,
      p_preferred_km_max: lead.preference.kmMax,
      p_preferred_max_owners: lead.preference.maxOwners,
    });

    if (error !== null) {
      translateLeadWriteError(error, 'Failed to save lead');
    }
  }

  async scheduleFollowUp(followUp: FollowUp): Promise<void> {
    const { error } = await this.db.rpc('schedule_follow_up', {
      p_id: followUp.id,
      p_lead_id: followUp.leadId,
      p_assigned_to: followUp.assignedTo,
      p_task_type: followUp.taskType.value,
      p_scheduled_at: followUp.scheduledAt.toISOString(),
      p_notes: followUp.notes,
      p_created_by: followUp.createdBy,
      p_notification_id: followUp.notificationId,
      p_due_at: followUp.dueAt.toISOString(),
    });

    if (error !== null) {
      translateLeadWriteError(error, 'Failed to schedule follow-up');
    }
  }
}
