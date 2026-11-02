import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';

interface ProviderError {
  readonly code?: string;
  readonly message: string;
}

/** Maps PostgREST/Postgres write failures on finance rows to typed errors. */
export function translateFinanceWriteError(error: ProviderError, fallbackMessage: string): never {
  if (error.code === '23503') {
    throw new NotFoundError('Referenced vehicle, showroom or user was not found');
  }
  throw new DatabaseUnavailableError(`${fallbackMessage}: ${error.message}`);
}
