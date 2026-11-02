/** The finance vault is already set up and confirmed. Mapped to HTTP 409. */
export class FinanceAlreadyInitializedError extends Error {
  readonly code = 'FINANCE_ALREADY_INITIALIZED';

  constructor(message = 'Finance is already set up') {
    super(message);
    this.name = 'FinanceAlreadyInitializedError';
  }
}
