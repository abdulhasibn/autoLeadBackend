/**
 * Thrown when an admin would remove the last remaining admin or deactivate
 * their own account. Mapped to HTTP 409 by the users feature error mapper.
 */
export class LastAdminProtectedError extends Error {
  readonly code = 'LAST_ADMIN_PROTECTED';

  constructor(message = 'Cannot remove the last remaining admin') {
    super(message);
    this.name = 'LastAdminProtectedError';
  }
}
