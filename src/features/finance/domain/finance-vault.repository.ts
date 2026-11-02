import type { FinanceVaultId } from './finance-vault-id';
import type { FinanceVault } from './finance-vault.entity';

/** Command-side persistence for the single finance vault. */
export interface IFinanceVaultRepository {
  find(): Promise<FinanceVault | null>;
  /** Inserts or updates the vault by id. */
  save(vault: FinanceVault): Promise<void>;
  /** Removes an unconfirmed vault so setup can start over. */
  delete(id: FinanceVaultId): Promise<void>;
}
