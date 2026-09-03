/**
 * Raised when persisted data contradicts a required domain invariant.
 */
export class DataIntegrityError extends Error {
  readonly code = 'DATA_INTEGRITY';

  constructor(message = 'Persisted data is inconsistent', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataIntegrityError';
  }
}
