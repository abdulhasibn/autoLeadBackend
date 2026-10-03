import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { UniqueViolationError } from '../../../domain/errors/unique-violation.error';

interface ProviderError {
  readonly code?: string;
  readonly message: string;
}

/**
 * Maps PostgREST/Postgres write failures to typed infrastructure errors.
 */
export function translateWriteError(error: ProviderError, fallbackMessage: string): never {
  if (error.code === '23505') {
    if (error.message.includes('users_email_active_uidx')) {
      throw new UniqueViolationError('A staff user with this email already exists');
    }
    throw new UniqueViolationError('A staff user with this phone already exists');
  }
  if (error.code === '23503') {
    throw new NotFoundError('Referenced record was not found');
  }
  throw new DatabaseUnavailableError(`${fallbackMessage}: ${error.message}`);
}
