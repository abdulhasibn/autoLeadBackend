/** Too many wrong keys; unlock is paused. Mapped to HTTP 429. */
export class FinanceUnlockBlockedError extends Error {
  readonly code = 'FINANCE_UNLOCK_BLOCKED';

  constructor(readonly minutesLeft: number) {
    super(
      `Too many wrong keys. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    );
    this.name = 'FinanceUnlockBlockedError';
  }
}
