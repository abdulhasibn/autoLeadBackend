/**
 * Generic infrastructure error — thrown when a unique constraint is violated.
 * Mapped to HTTP 409.
 */
export class UniqueViolationError extends Error {
  readonly code = 'UNIQUE_VIOLATION';

  constructor(message = 'Unique constraint violated') {
    super(message);
    this.name = 'UniqueViolationError';
  }
}
