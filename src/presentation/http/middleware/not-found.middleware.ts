import type { NextFunction, Request, Response } from 'express';

import { NotFoundError } from '../../../domain/errors/not-found.error';

/**
 * Mounted after every route. Unmatched requests are forwarded to the error
 * handler as a NotFoundError.
 */
export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
}
