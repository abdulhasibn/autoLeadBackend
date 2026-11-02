import type { SupabaseClient } from '@supabase/supabase-js';

import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type {
  FinanceVaultStateReadModel,
  IFinanceVaultQueries,
} from '../domain/finance-vault.queries';

export class SupabaseFinanceVaultQueries implements IFinanceVaultQueries {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getVaultState(): Promise<FinanceVaultStateReadModel | null> {
    const { data, error } = await this.db
      .from('finance_vault')
      .select('status')
      .eq('singleton', true)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance vault state: ${error.message}`);
    }
    if (data === null) {
      return null;
    }
    if (data.status !== 'pending' && data.status !== 'active') {
      throw new DataIntegrityError(`Unknown finance vault status: ${data.status}`);
    }
    return { status: data.status };
  }
}
