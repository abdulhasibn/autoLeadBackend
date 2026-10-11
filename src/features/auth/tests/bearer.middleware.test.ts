import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

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
});
