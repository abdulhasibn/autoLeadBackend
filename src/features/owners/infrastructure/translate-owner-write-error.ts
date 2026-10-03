import { ConflictError } from '../../../domain/errors/conflict.error';
import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';

interface ProviderError {
  readonly code?: string;
  readonly message: string;
}

/**
 * Maps PostgREST/Postgres write failures to typed infrastructure errors.
 */
export function translateOwnerWriteError(error: ProviderError, fallbackMessage: string): never {
  if (error.code === '23505') {
    throw new ConflictError('Owner with this phone already exists');
  }
  if (error.code === '23503') {
    throw new NotFoundError('Referenced record was not found');
  }
  throw new DatabaseUnavailableError(`${fallbackMessage}: ${error.message}`);
}
