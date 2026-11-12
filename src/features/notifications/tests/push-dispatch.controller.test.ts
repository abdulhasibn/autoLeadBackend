import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { AuthenticationRequiredError } from '../../../domain/errors/authentication-required.error';
import type { DispatchPendingPushesUseCase } from '../application/use-cases/dispatch-pending-pushes.use-case';
import {
  PUSH_SECRET_HEADER,
  PushDispatchController,
} from '../presentation/controllers/push-dispatch.controller';

const SECRET = 'a-long-enough-shared-secret';

async function call(secret: string | null, header: string | undefined) {
  const execute = vi.fn(async () => ({ notifications: 2, pushes: 3 }));
  const controller = new PushDispatchController(
    { execute } as unknown as DispatchPendingPushesUseCase,
    secret,
  );
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const req = {
    header: (name: string) => (name === PUSH_SECRET_HEADER ? header : undefined),
  } as unknown as Request;
  const next = vi.fn();

  await controller.handle()(req, res, next);
  return { execute, json, next, res };
}

describe('PushDispatchController', () => {
  it('rejects a request without the secret', async () => {
    const { execute, next } = await call(SECRET, undefined);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AuthenticationRequiredError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret', async () => {
    const { execute, next } = await call(SECRET, 'something-else-entirely!');
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AuthenticationRequiredError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects everything when no secret is configured', async () => {
    const { execute, next } = await call(null, SECRET);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AuthenticationRequiredError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('dispatches with the right secret', async () => {
    const { execute, json, next } = await call(SECRET, SECRET);
    expect(next).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
    expect(json).toHaveBeenCalledWith({ notifications: 2, pushes: 3 });
  });
});
