/** Keys shown to the admin exactly once. Never logged or stored in plaintext. */
export interface VaultKeysDto {
  readonly financeKey: string;
  readonly recoveryKey: string;
}

export interface FinanceKeyDto {
  readonly financeKey: string;
}
