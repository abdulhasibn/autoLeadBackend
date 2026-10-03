/**
 * Application/authorization error — the authenticated actor is not allowed
 * to perform the requested operation. Mapped to HTTP 403.
 */
export class ForbiddenActionError extends Error {
  readonly code = 'FORBIDDEN';

  constructor(message = 'You are not allowed to perform this action') {
    super(message);
    this.name = 'ForbiddenActionError';
  }
}
