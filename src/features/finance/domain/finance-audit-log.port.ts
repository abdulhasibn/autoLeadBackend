import type { UserId } from '../../../domain/shared/user-id';
import type { FinanceVaultId } from './finance-vault-id';

export type FinanceAuditAction =
  | 'finance.setup'
  | 'finance.confirm'
  | 'finance.unlock'
  | 'finance.unlock_failed'
  | 'finance.lock'
  | 'finance.change_key'
  | 'finance.recover';

/**
 * Append-only record of vault actions. Entries name the action, vault and
 * actor only, never amounts, keys or tokens (ADR-0014).
 */
export interface IFinanceAuditLog {
  record(entry: {
    readonly action: FinanceAuditAction;
    readonly vaultId: FinanceVaultId;
    readonly actorId: UserId;
    readonly at: Date;
  }): Promise<void>;
}
