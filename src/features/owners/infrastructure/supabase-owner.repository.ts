import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { UserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Owner } from '../domain/owner.entity';
import type { IOwnerRepository } from '../domain/owner.repository';
import type { OwnerId } from '../../../domain/shared/owner-id';
import { toOwner, type OwnerRow } from './owner.mapper';
import { translateOwnerWriteError } from './translate-owner-write-error';

export class SupabaseOwnerRepository implements IOwnerRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: OwnerId): Promise<Owner | null> {
    const { data, error } = await this.db
      .from('owners')
      .select(
        'id, user_id, full_name, phone, email, address, city, preferred_contact_method, alt_phone, id_info, notes, created_by, created_at, updated_at, deleted_at',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load owner: ${error.message}`);
    }
    if (data === null) {
      return null;
    }

    return toOwner(data as OwnerRow);
  }

  async isLive(id: OwnerId): Promise<boolean> {
    const owner = await this.findById(id);
    return owner !== null;
  }

  async save(owner: Owner, createdBy: UserId): Promise<void> {
    const { data, error: lookupError } = await this.db
      .from('owners')
      .select('id')
      .eq('id', owner.id)
      .maybeSingle();

    if (lookupError !== null) {
      throw new DatabaseUnavailableError(`Failed to save owner: ${lookupError.message}`);
    }

    if (data === null) {
      const { error } = await this.db.from('owners').insert({
        id: owner.id,
        user_id: owner.userId,
        full_name: owner.fullName,
        phone: owner.phone.value,
        email: owner.email,
        address: owner.address,
        city: owner.city,
        preferred_contact_method: owner.preferredContactMethod,
        alt_phone: owner.altPhone === null ? null : owner.altPhone.value,
        id_info: owner.idInfo,
        notes: owner.notes,
        created_by: createdBy,
        created_at: owner.createdAt.toISOString(),
        updated_at: owner.updatedAt.toISOString(),
        deleted_at: owner.deletedAt === null ? null : owner.deletedAt.toISOString(),
      });

      if (error !== null) {
        translateOwnerWriteError(error, 'Failed to save owner');
      }
      return;
    }

    const { error } = await this.db
      .from('owners')
      .update({
        full_name: owner.fullName,
        phone: owner.phone.value,
        email: owner.email,
        address: owner.address,
        city: owner.city,
        preferred_contact_method: owner.preferredContactMethod,
        alt_phone: owner.altPhone === null ? null : owner.altPhone.value,
        id_info: owner.idInfo,
        notes: owner.notes,
        updated_at: owner.updatedAt.toISOString(),
        deleted_at: owner.deletedAt === null ? null : owner.deletedAt.toISOString(),
      })
      .eq('id', owner.id);

    if (error !== null) {
      translateOwnerWriteError(error, 'Failed to save owner');
    }
  }
}
