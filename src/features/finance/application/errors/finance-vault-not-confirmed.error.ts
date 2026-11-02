/**
 * The vault exists but the recovery key hasn't been confirmed, so it can't be
 * unlocked yet. Mapped to HTTP 409.
 */
export class FinanceVaultNotConfirmedError extends Error {
  readonly code = 'FINANCE_VAULT_NOT_CONFIRMED';

  constructor(message = 'Confirm the recovery key before using finance') {
    super(message);
    this.name = 'FinanceVaultNotConfirmedError';
  }
}
