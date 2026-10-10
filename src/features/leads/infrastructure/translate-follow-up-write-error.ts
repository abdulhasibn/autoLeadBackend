import { ConflictError } from '../../../domain/errors/conflict.error';
import { translateLeadWriteError } from './translate-lead-write-error';

interface ProviderError {
  readonly code?: string;
  readonly message: string;
}

/** 55000 is raised when another request closed the follow-up first. */
export function translateFollowUpWriteError(error: ProviderError, fallbackMessage: string): never {
  if (error.code === '55000') {
    throw new ConflictError('Follow-up is no longer open');
  }
  return translateLeadWriteError(error, fallbackMessage);
}
