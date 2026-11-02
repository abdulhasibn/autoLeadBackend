/**
 * No valid finance session: the header is missing, malformed, expired, or
 * belongs to someone else. Mapped to HTTP 423; the client asks for the key.
 */
export class FinanceLockedError extends Error {
  readonly code = 'FINANCE_LOCKED';

  constructor(message = 'Finance is locked. Enter the finance key to unlock it.') {
    super(message);
    this.name = 'FinanceLockedError';
  }
}
