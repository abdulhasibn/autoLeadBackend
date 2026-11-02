import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceAuditAction, IFinanceAuditLog } from '../domain/finance-audit-log.port';
import type { FinanceVaultId } from '../domain/finance-vault-id';
import type { UserId } from '../../../domain/shared/user-id';

/** Writes vault actions to `audit_logs` without any values (ADR-0014). */
export class SupabaseFinanceAuditLog implements IFinanceAuditLog {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async record(entry: {
    readonly action: FinanceAuditAction;
    readonly vaultId: FinanceVaultId;
    readonly actorId: UserId;
    readonly at: Date;
  }): Promise<void> {
    const { error } = await this.db.from('audit_logs').insert({
      entity_type: 'finance_vault',
      entity_id: entry.vaultId,
      action: entry.action,
      actor_id: entry.actorId,
      created_at: entry.at.toISOString(),
    });

    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to record finance audit entry: ${error.message}`);
    }
  }
}
