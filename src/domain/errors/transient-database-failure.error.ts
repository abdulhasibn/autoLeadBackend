/**
 * Generic infrastructure error — thrown when a database operation fails in a
 * retryable way. Mapped to HTTP 503.
 */
export class TransientDatabaseFailureError extends Error {
  readonly code = 'DB_TRANSIENT';

  constructor(message = 'Transient database failure', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransientDatabaseFailureError';
  }
}
