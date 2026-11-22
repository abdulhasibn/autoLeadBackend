import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import { AuthenticationRequiredError } from '../../../domain/errors/authentication-required.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { AuthenticateActorUseCase } from '../application/use-cases/authenticate-actor.use-case';
import { createBearerMiddleware } from '../presentation/middleware/bearer.middleware';

const ACTOR: AuthenticatedContext = {
  userId: toUserId('11111111-1111-4111-8111-111111111111'),
  roles: ['admin'],
  showroomId: null,
};

function middlewareResolving(actor: AuthenticatedContext | null) {
  const authenticate = { execute: async () => actor } as unknown as AuthenticateActorUseCase;
  return createBearerMiddleware(authenticate);
}

async function run(
  actor: AuthenticatedContext | null,
  authorization: string | undefined,
): Promise<{ req: Request; error: unknown }> {
  const req = { headers: { authorization } } as Request;
  let error: unknown;
  await middlewareResolving(actor)(req, {} as Response, (err?: unknown) => {
    error = err;
  });
  return { req, error };
}

describe('bearer middleware', () => {
  it('attaches the actor and the raw token', async () => {
    const { req, error } = await run(ACTOR, 'Bearer token-a');

    expect(error).toBeUndefined();
    expect(req.auth).toEqual(ACTOR);
    expect(req.accessToken).toBe('token-a');
  });

  it('rejects an invalid token without attaching anything', async () => {
    const { req, error } = await run(null, 'Bearer token-a');

    expect(error).toBeInstanceOf(AuthenticationRequiredError);
    expect(req.accessToken).toBeUndefined();
  });

  it.each([undefined, 'Basic abc', 'Bearer   '])('rejects the header %s', async (header) => {
    const { error } = await run(ACTOR, header);

    expect(error).toBeInstanceOf(AuthenticationRequiredError);
  });

  it('passes a provider failure on as itself, not as a 401', async () => {
    const outage = new DatabaseUnavailableError('Failed to verify token: fetch failed');
    const authenticate = {
      execute: async () => {
        throw outage;
      },
    } as unknown as AuthenticateActorUseCase;
    const req = { headers: { authorization: 'Bearer token-a' } } as Request;
    let error: unknown;
    await createBearerMiddleware(authenticate)(req, {} as Response, (err?: unknown) => {
      error = err;
    });

    expect(error).toBe(outage);
    expect(error).not.toBeInstanceOf(AuthenticationRequiredError);
    expect(req.auth).toBeUndefined();
  });
});
