import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceEntryId } from '../domain/finance-entry-id';
import type { IFinanceEntryRepository } from '../domain/finance-entry.repository';
import type { SealedFinanceEntry } from '../domain/sealed-finance-records';
import {
  FINANCE_ENTRY_COLUMNS,
  toFinanceEntryRow,
  toSealedFinanceEntry,
} from './finance-entry.mapper';
import { translateFinanceWriteError } from './translate-finance-write-error';

export class SupabaseFinanceEntryRepository implements IFinanceEntryRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: FinanceEntryId): Promise<SealedFinanceEntry | null> {
    const { data, error } = await this.db
      .from('finance_entries')
      .select(FINANCE_ENTRY_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance entry: ${error.message}`);
    }
    return data === null ? null : toSealedFinanceEntry(data);
  }

  async save(entry: SealedFinanceEntry): Promise<void> {
    const { error } = await this.db
      .from('finance_entries')
      .upsert(toFinanceEntryRow(entry), { onConflict: 'id' });

    if (error !== null) {
      translateFinanceWriteError(error, 'Failed to save finance entry');
    }
  }
}
