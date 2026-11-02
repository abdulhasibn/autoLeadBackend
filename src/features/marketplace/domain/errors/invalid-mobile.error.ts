export class InvalidMobileError extends Error {
  readonly code = 'INVALID_PHONE';

  constructor(message = 'Enter a valid 10-digit Indian mobile number') {
    super(message);
    this.name = 'InvalidMobileError';
  }
}
