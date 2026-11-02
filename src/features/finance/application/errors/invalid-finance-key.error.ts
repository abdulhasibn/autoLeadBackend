/**
 * A well-formed finance or recovery key that doesn't open the vault. Counts
 * toward the unlock lockout. Mapped to HTTP 422.
 */
export class InvalidFinanceKeyError extends Error {
  readonly code = 'INVALID_FINANCE_KEY';

  constructor(message = 'The key is not correct') {
    super(message);
    this.name = 'InvalidFinanceKeyError';
  }
}
