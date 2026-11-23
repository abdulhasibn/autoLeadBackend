/**
 * A well-formed finance or recovery key that doesn't open the vault. Counts
 * toward the unlock lockout. Mapped to HTTP 422.
 */
export class InvalidFinanceKeyError extends Error {
  readonly code = 'INVALID_FINANCE_KEY';

  /**
   * @param attemptsLeft wrong keys still allowed before the unlock pause
   *   (0 when this one triggered it); omitted where no lockout counting applies.
   */
  constructor(
    readonly attemptsLeft?: number,
    message = 'The key is not correct',
  ) {
    super(message);
    this.name = 'InvalidFinanceKeyError';
  }
}
