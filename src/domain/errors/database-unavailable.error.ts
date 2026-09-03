/**
 * Generic infrastructure error — thrown when the database or Supabase is
 * unreachable. Mapped to HTTP 503.
 */
export class DatabaseUnavailableError extends Error {
  readonly code = 'DB_UNAVAILABLE';

  constructor(message = 'Database unavailable', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DatabaseUnavailableError';
  }
}
