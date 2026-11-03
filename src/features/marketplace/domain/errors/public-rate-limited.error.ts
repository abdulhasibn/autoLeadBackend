export class PublicRateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';

  constructor(message = 'Too many requests, please try again later') {
    super(message);
    this.name = 'PublicRateLimitedError';
  }
}
