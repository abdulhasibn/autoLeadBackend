import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { AuthenticationRequiredError } from '../../../domain/errors/authentication-required.error';
import { ConflictError } from '../../../domain/errors/conflict.error';
import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import { TransientDatabaseFailureError } from '../../../domain/errors/transient-database-failure.error';
import { UniqueViolationError } from '../../../domain/errors/unique-violation.error';
import type { Logger } from '../../../shared/logging/logger.port';
import type { ErrorMapper, HttpErrorMapping } from './error-mapping';

interface ErrorResponseBody {
  readonly error: { readonly code: string; readonly message: string };
}

/**
 * The single place in the codebase that maps errors to HTTP responses.
 */
export function createErrorHandlerMiddleware(
  logger: Logger,
  featureErrorMappers: readonly ErrorMapper[] = [],
): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const log: Logger = req.log ?? logger;
    const { status, body } = mapError(err, featureErrorMappers);

    if (status >= 500) {
      log.error({ err, path: req.path, method: req.method }, 'Unhandled error');
    } else {
      log.warn({ err, path: req.path, method: req.method }, 'Request rejected');
    }

    res.status(status).json(body);
  };
}

function mapError(
  err: unknown,
  featureErrorMappers: readonly ErrorMapper[],
): { status: number; body: ErrorResponseBody } {
  if (err instanceof ZodError) {
    return {
      status: 422,
      body: { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } },
    };
  }
  if (err instanceof AuthenticationRequiredError) {
    return { status: 401, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof NotFoundError) {
    return { status: 404, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof ConflictError || err instanceof UniqueViolationError) {
    return { status: 409, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof DatabaseUnavailableError || err instanceof TransientDatabaseFailureError) {
    return { status: 503, body: { error: { code: err.code, message: err.message } } };
  }
  if (err instanceof DataIntegrityError) {
    return { status: 500, body: { error: { code: err.code, message: 'Internal server error' } } };
  }

  const featureMapping = featureErrorMappers
    .map((mapper) => mapper(err))
    .find((mapping): mapping is HttpErrorMapping => mapping !== null);

  if (featureMapping !== undefined) {
    return {
      status: featureMapping.status,
      body: { error: { code: featureMapping.code, message: featureMapping.message } },
    };
  }

  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
  };
}
