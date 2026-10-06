import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { Email } from '../../../domain/shared/email.value-object';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { Contact } from '../domain/contact.entity';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { toLeadId } from '../../../domain/shared/lead-id';
import type {
  LeadFollowUpReadModel,
  LeadReadModel,
  LinkedVehicleReadModel,
} from '../domain/lead.queries';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { PreferredCatalog } from '../domain/preferred-catalog.value-object';

export interface ContactRow {
  readonly id: string;
  readonly full_name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly created_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface LeadRow {
  readonly id: string;
  readonly showroom_id: string;
  readonly vehicle_id: string | null;
  readonly assigned_to: string | null;
  readonly contact_id: string | null;
  readonly source: string;
  readonly status: string;
  readonly budget: number | null;
  readonly preferred_vehicle: string | null;
  readonly preferred_make_id: string | null;
  readonly preferred_model_id: string | null;
  readonly preferred_variant_id: string | null;
  readonly purchase_timeline: string | null;
  readonly finance_required: boolean | null;
  readonly current_vehicle: string | null;
  readonly trade_in_required: boolean | null;
  readonly notes: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface FollowUpEmbed {
  readonly id: string;
  readonly task_type: string;
  readonly scheduled_at: string;
  readonly notes: string | null;
  readonly completed_at: string | null;
  readonly deleted_at: string | null;
}

export interface LeadListRow extends LeadRow {
  readonly contacts: {
    readonly full_name: string;
    readonly phone: string;
    readonly email: string | null;
    readonly deleted_at: string | null;
  } | null;
  readonly follow_ups: FollowUpEmbed[] | null;
  readonly linked_vehicle: LinkedVehicleEmbed | null;
  readonly preferred_make: NameEmbed | null;
  readonly preferred_model: NameEmbed | null;
  readonly preferred_variant: NameEmbed | null;
}

interface NameEmbed {
  readonly name: string;
}

export interface LinkedVehicleEmbed {
  readonly id: string;
  readonly year: number;
  readonly registration_number: string;
  readonly deleted_at: string | null;
  readonly variants: {
    readonly name: string;
    readonly models: { readonly name: string; readonly makes: NameEmbed | null } | null;
  } | null;
}

export function toContact(row: ContactRow): Contact {
  return Contact.reconstitute({
    id: toContactId(row.id),
    fullName: row.full_name,
    phone: mapVo(row.phone, row.id, 'phone', (value) => Phone.create(value)),
    email:
      row.email === null ? null : mapVo(row.email, row.id, 'email', (value) => Email.create(value)),
    createdBy: row.created_by === null ? null : toUserId(row.created_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  });
}

export function toLead(row: LeadRow): Lead {
  if (row.contact_id === null) {
    throw new DataIntegrityError(`Lead ${row.id} is missing contact_id`);
  }

  return Lead.reconstitute({
    id: toLeadId(row.id),
    showroomId: toShowroomId(row.showroom_id),
    contactId: toContactId(row.contact_id),
    vehicleId: row.vehicle_id === null ? null : toVehicleId(row.vehicle_id),
    assignedTo: row.assigned_to === null ? null : toUserId(row.assigned_to),
    source: mapVo(row.source, row.id, 'source', (value) => LeadSource.create(value)),
    status: mapVo(row.status, row.id, 'status', (value) => LeadStatus.create(value)),
    budget: row.budget,
    preferredVehicle: row.preferred_vehicle,
    preferredCatalog: mapVo(row, row.id, 'preferred catalog', (value) =>
      PreferredCatalog.create({
        makeId: value.preferred_make_id,
        modelId: value.preferred_model_id,
        variantId: value.preferred_variant_id,
      }),
    ),
    purchaseTimeline: row.purchase_timeline,
    financeRequired: row.finance_required,
    currentVehicle: row.current_vehicle,
    tradeInRequired: row.trade_in_required,
    notes: row.notes,
    createdBy: toUserId(row.created_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  });
}

export function toLeadReadModel(row: LeadListRow): LeadReadModel | null {
  if (row.deleted_at !== null || row.contact_id === null || row.contacts === null) {
    return null;
  }
  if (row.contacts.deleted_at !== null) {
    return null;
  }

  return {
    id: row.id,
    showroomId: row.showroom_id,
    vehicleId: row.vehicle_id,
    linkedVehicle: toLinkedVehicle(row.linked_vehicle),
    assignedTo: row.assigned_to,
    contactId: row.contact_id,
    contactFullName: row.contacts.full_name,
    contactPhone: row.contacts.phone,
    contactEmail: row.contacts.email,
    source: row.source,
    status: row.status,
    budget: row.budget,
    preferredVehicle: row.preferred_vehicle,
    preferredMakeId: row.preferred_make_id,
    preferredMakeName: row.preferred_make?.name ?? null,
    preferredModelId: row.preferred_model_id,
    preferredModelName: row.preferred_model?.name ?? null,
    preferredVariantId: row.preferred_variant_id,
    preferredVariantName: row.preferred_variant?.name ?? null,
    purchaseTimeline: row.purchase_timeline,
    financeRequired: row.finance_required,
    currentVehicle: row.current_vehicle,
    tradeInRequired: row.trade_in_required,
    notes: row.notes,
    nextFollowUp: nextFollowUp(row.follow_ups ?? []),
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toLinkedVehicle(embed: LinkedVehicleEmbed | null): LinkedVehicleReadModel | null {
  if (embed === null || embed.deleted_at !== null) {
    return null;
  }
  return {
    id: embed.id,
    makeName: embed.variants?.models?.makes?.name ?? null,
    modelName: embed.variants?.models?.name ?? null,
    variantName: embed.variants?.name ?? null,
    year: embed.year,
    registrationNumber: embed.registration_number,
  };
}

function nextFollowUp(rows: readonly FollowUpEmbed[]): LeadFollowUpReadModel | null {
  const open = rows
    .filter((row) => row.completed_at === null && row.deleted_at === null)
    .slice()
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const first = open[0];
  if (first === undefined) {
    return null;
  }
  return {
    id: first.id,
    taskType: first.task_type,
    scheduledAt: new Date(first.scheduled_at).toISOString(),
    notes: first.notes,
  };
}

function mapVo<T, U>(value: T, leadId: string, field: string, create: (input: T) => U): U {
  try {
    return create(value);
  } catch (err) {
    throw new DataIntegrityError(`Lead ${leadId} has an invalid ${field}`, { cause: err });
  }
}
