import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceVaultId } from '../domain/finance-vault-id';
import type { FinanceVault } from '../domain/finance-vault.entity';
import type { IFinanceVaultRepository } from '../domain/finance-vault.repository';
import { FINANCE_VAULT_COLUMNS, toFinanceVault, toFinanceVaultRow } from './finance-vault.mapper';

export class SupabaseFinanceVaultRepository implements IFinanceVaultRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async find(): Promise<FinanceVault | null> {
    const { data, error } = await this.db
      .from('finance_vault')
      .select(FINANCE_VAULT_COLUMNS)
      .eq('singleton', true)
      .maybeSingle();

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load finance vault: ${error.message}`);
    }
    return data === null ? null : toFinanceVault(data);
  }

  async save(vault: FinanceVault): Promise<void> {
    const { error } = await this.db
      .from('finance_vault')
      .upsert(toFinanceVaultRow(vault), { onConflict: 'id' });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to save finance vault: ${error.message}`);
    }
  }

  async delete(id: FinanceVaultId): Promise<void> {
    const { error } = await this.db.from('finance_vault').delete().eq('id', id);

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to delete finance vault: ${error.message}`);
    }
  }
}
