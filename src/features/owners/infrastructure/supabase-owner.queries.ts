import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { IOwnerQueries, OwnerListCriteria, OwnerReadModel } from '../domain/owner.queries';
import type { OwnerId } from '../domain/owner-id';
import { toOwnerReadModel, type OwnerRow } from './owner.mapper';

export class SupabaseOwnerQueries implements IOwnerQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listOwners(criteria: OwnerListCriteria, page: Pagination): Promise<Page<OwnerReadModel>> {
    let query = this.db
      .from('owners')
      .select(
        'id, user_id, full_name, phone, email, address, city, preferred_contact_method, alt_phone, id_info, notes, created_by, created_at, updated_at, deleted_at',
        { count: 'exact' },
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (criteria.city !== undefined) {
      query = query.eq('city', criteria.city);
    }
    if (criteria.phone !== undefined) {
      query = query.eq('phone', criteria.phone);
    }

    const { data, error, count } = await query.range(page.offset, page.offset + page.limit - 1);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list owners: ${error.message}`);
    }

    const items = ((data ?? []) as OwnerRow[])
      .map((row) => toOwnerReadModel(row))
      .filter((item): item is OwnerReadModel => item !== null);

    return toPage(items, count ?? items.length, page);
  }

  async getOwner(id: OwnerId): Promise<OwnerReadModel | null> {
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

    return toOwnerReadModel(data as OwnerRow);
  }
}
