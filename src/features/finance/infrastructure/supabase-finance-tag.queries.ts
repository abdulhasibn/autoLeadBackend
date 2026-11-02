import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { IFinanceTagQueries } from '../domain/finance-tag.queries';
import type { SealedFinanceTag } from '../domain/sealed-finance-records';
import { FINANCE_TAG_COLUMNS, toSealedFinanceTag } from './finance-tag.mapper';

export class SupabaseFinanceTagQueries implements IFinanceTagQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listAll(): Promise<readonly SealedFinanceTag[]> {
    const { data, error } = await this.db.from('finance_tags').select(FINANCE_TAG_COLUMNS);
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to list finance tags: ${error.message}`);
    }
    return (data ?? []).map(toSealedFinanceTag);
  }
}
