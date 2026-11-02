/** The finance vault has not been set up yet. Mapped to HTTP 409. */
export class FinanceNotInitializedError extends Error {
  readonly code = 'FINANCE_NOT_INITIALIZED';

  constructor(message = 'Finance has not been set up yet') {
    super(message);
    this.name = 'FinanceNotInitializedError';
  }
}
