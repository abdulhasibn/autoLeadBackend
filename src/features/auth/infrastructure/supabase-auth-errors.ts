import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';

/** The fields of a Supabase AuthError this feature branches on. */
export interface AuthErrorLike {
  readonly message: string;
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

/**
 * Thrown when Supabase Auth throttles a request (`over_*_rate_limit`).
 * Mapped to 429 via the feature error mapper registered in composition.
 */
export class AuthRateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';

  constructor() {
    super('Too many attempts. Wait a minute and try again');
    this.name = 'AuthRateLimitedError';
  }
}

export function isRateLimited(error: AuthErrorLike): boolean {
  return error.status === 429 || (error.code?.startsWith('over_') ?? false);
}

/** 5xx or no status at all (network failure): the provider, not the caller, failed. */
export function isProviderFailure(error: AuthErrorLike): boolean {
  return error.status === undefined || error.status === 0 || error.status >= 500;
}

/** Rate limits become 429; anything else becomes 503. */
export function toUnexpectedAuthError(error: AuthErrorLike, action: string): Error {
  if (isRateLimited(error)) {
    return new AuthRateLimitedError();
  }
  return new DatabaseUnavailableError(`Failed to ${action}: ${error.message}`);
}
