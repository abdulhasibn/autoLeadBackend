import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

import { AuthenticationRequiredError } from '../../../../domain/errors/authentication-required.error';
import type { DispatchPendingPushesUseCase } from '../../application/use-cases/dispatch-pending-pushes.use-case';

export const PUSH_SECRET_HEADER = 'x-push-secret';

function secretMatches(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called by the database (trigger + minute sweep). Guarded by a shared secret. */
export class PushDispatchController {
  constructor(
    private readonly dispatch: DispatchPendingPushesUseCase,
    private readonly secret: string | null,
  ) {}

  handle(): RequestHandler {
    return async (req, res, next) => {
      try {
        if (this.secret === null || !secretMatches(req.header(PUSH_SECRET_HEADER), this.secret)) {
          throw new AuthenticationRequiredError();
        }
        res.status(200).json(await this.dispatch.execute());
      } catch (err) {
        next(err);
      }
    };
  }
}
