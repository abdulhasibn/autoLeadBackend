import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceTagId } from '../domain/finance-tag-id';
import type { IFinanceTagRepository } from '../domain/finance-tag.repository';
import type { SealedFinanceTag } from '../domain/sealed-finance-records';
import { FINANCE_TAG_COLUMNS, toFinanceTagRow, toSealedFinanceTag } from './finance-tag.mapper';

export class SupabaseFinanceTagRepository implements IFinanceTagRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findAll(): Promise<readonly SealedFinanceTag[]> {
    const { data, error } = await this.db.from('finance_tags').select(FINANCE_TAG_COLUMNS);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance tags: ${error.message}`);
    }
    return (data ?? []).map(toSealedFinanceTag);
  }

  async findById(id: FinanceTagId): Promise<SealedFinanceTag | null> {
    const { data, error } = await this.db
      .from('finance_tags')
      .select(FINANCE_TAG_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance tag: ${error.message}`);
    }
    return data === null ? null : toSealedFinanceTag(data);
  }

  async findByIds(ids: readonly FinanceTagId[]): Promise<readonly SealedFinanceTag[]> {
    if (ids.length === 0) {
      return [];
    }
    const { data, error } = await this.db
      .from('finance_tags')
      .select(FINANCE_TAG_COLUMNS)
      .in('id', [...ids]);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance tags: ${error.message}`);
    }
    return (data ?? []).map(toSealedFinanceTag);
  }

  async save(tag: SealedFinanceTag): Promise<void> {
    await this.saveMany([tag]);
  }

  async saveMany(tags: readonly SealedFinanceTag[]): Promise<void> {
    const { error } = await this.db
      .from('finance_tags')
      .upsert(tags.map(toFinanceTagRow), { onConflict: 'id' });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to save finance tags: ${error.message}`);
    }
  }

  async count(): Promise<number> {
    const { count, error } = await this.db
      .from('finance_tags')
      .select('id', { count: 'exact', head: true });
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to count finance tags: ${error.message}`);
    }
    return count ?? 0;
  }
}
