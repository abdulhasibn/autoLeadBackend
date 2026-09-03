/**
 * Generic infrastructure error — thrown when an operation conflicts with the
 * current state of a record. Mapped to HTTP 409.
 */
export class ConflictError extends Error {
  readonly code = 'CONFLICT';

  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}
