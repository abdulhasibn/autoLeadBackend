import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { Phone } from '../../../domain/shared/phone.value-object';
import { toUserId } from '../../../domain/shared/user-id';
import { Owner, parsePreferredContactMethod } from '../domain/owner.entity';
import type { OwnerReadModel } from '../domain/owner.queries';
import { toOwnerId } from '../../../domain/shared/owner-id';

export interface OwnerRow {
  readonly id: string;
  readonly user_id: string | null;
  readonly full_name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly preferred_contact_method: string | null;
  readonly alt_phone: string | null;
  readonly id_info: string | null;
  readonly notes: string | null;
  readonly created_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export function toOwner(row: OwnerRow): Owner {
  return Owner.reconstitute({
    id: toOwnerId(row.id),
    userId: row.user_id === null ? null : toUserId(row.user_id),
    fullName: row.full_name,
    phone: toPhone(row.phone, row.id, 'phone'),
    email: row.email,
    address: row.address,
    city: row.city,
    preferredContactMethod: toPreferredContact(row.preferred_contact_method, row.id),
    altPhone: row.alt_phone === null ? null : toPhone(row.alt_phone, row.id, 'alt_phone'),
    idInfo: row.id_info,
    notes: row.notes,
    createdBy: row.created_by === null ? null : toUserId(row.created_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  });
}

export function toOwnerReadModel(row: OwnerRow): OwnerReadModel | null {
  if (row.deleted_at !== null) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    preferredContactMethod: row.preferred_contact_method,
    altPhone: row.alt_phone,
    idInfo: row.id_info,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toPhone(raw: string, ownerId: string, field: string): Phone {
  try {
    return Phone.create(raw);
  } catch (err) {
    throw new DataIntegrityError(`Owner ${ownerId} has an invalid ${field}`, { cause: err });
  }
}

function toPreferredContact(
  raw: string | null,
  ownerId: string,
): ReturnType<typeof parsePreferredContactMethod> {
  try {
    return parsePreferredContactMethod(raw);
  } catch (err) {
    throw new DataIntegrityError(`Owner ${ownerId} has an invalid preferred_contact_method`, {
      cause: err,
    });
  }
}
