export class AuthenticationRequiredError extends Error {
  readonly code = 'AUTHENTICATION_FAILED';

  constructor() {
    super('Authentication is required');
    this.name = 'AuthenticationRequiredError';
  }
}
