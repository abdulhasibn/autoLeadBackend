import { ConflictError } from '../../../domain/errors/conflict.error';
import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';

interface ProviderError {
  readonly code?: string;
  readonly message: string;
}

export function translateVehicleWriteError(
  error: ProviderError,
  fallbackMessage: string,
  conflictMessage = 'Vehicle with this registration number already exists',
): never {
  if (error.code === '23505') {
    throw new ConflictError(conflictMessage);
  }
  if (error.code === '23503') {
    throw new NotFoundError('Referenced record was not found');
  }
  throw new DatabaseUnavailableError(`${fallbackMessage}: ${error.message}`);
}
