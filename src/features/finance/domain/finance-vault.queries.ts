import type { FinanceVaultStatus } from './finance-vault.entity';

export interface FinanceVaultStateReadModel {
  readonly status: FinanceVaultStatus;
}

/** Read side of the vault: whether it exists and is confirmed. No key material. */
export interface IFinanceVaultQueries {
  getVaultState(): Promise<FinanceVaultStateReadModel | null>;
}
