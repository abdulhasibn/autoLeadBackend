/**
 * Generic infrastructure error — thrown by repository implementations when a
 * required record does not exist. Mapped to HTTP 404.
 */
export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
