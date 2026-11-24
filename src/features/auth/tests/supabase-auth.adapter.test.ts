import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';

import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { SupabaseAuthAdapter } from '../infrastructure/supabase-auth.adapter';
import { AuthRateLimitedError } from '../infrastructure/supabase-auth-errors';

const adapter = new SupabaseAuthAdapter({} as SupabaseClient<Database>);

function jwtWith(payload: unknown): string {
  const part = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'ES256' })}.${part(payload)}.signature`;
}

describe('SupabaseAuthAdapter.claimedSubject', () => {
  it('reads the sub claim without verifying the token', () => {
    expect(adapter.claimedSubject(jwtWith({ sub: 'user-1' }))).toBe(toUserId('user-1'));
  });

  it.each([
    ['not a JWT', 'opaque-token'],
    ['an undecodable payload', 'a.%%%.c'],
    ['no sub claim', jwtWith({ role: 'authenticated' })],
    ['an empty sub', jwtWith({ sub: '' })],
    ['a non-string sub', jwtWith({ sub: 42 })],
    ['a non-object payload', jwtWith('just a string')],
  ])('returns null for %s', (_label, token) => {
    expect(adapter.claimedSubject(token)).toBeNull();
  });
});

interface GetUserResult {
  readonly data: { readonly user: { readonly id: string } | null };
  readonly error: {
    readonly message: string;
    readonly status?: number;
    readonly code?: string;
  } | null;
}

function adapterWithGetUser(...results: GetUserResult[]): {
  verify: (token: string) => Promise<unknown>;
  calls: () => number;
} {
  let calls = 0;
  const client = {
    auth: {
      getUser: async () => {
        const result = results[Math.min(calls, results.length - 1)];
        calls += 1;
        return result;
      },
    },
  };
  const adapter = new SupabaseAuthAdapter(client as unknown as SupabaseClient<Database>, 0);
  return { verify: (token) => adapter.verify(token), calls: () => calls };
}

const NETWORK_ERROR = { data: { user: null }, error: { message: 'fetch failed' } };

describe('SupabaseAuthAdapter.verify', () => {
  it('returns the user id for a valid token', async () => {
    const verifier = adapterWithGetUser({ data: { user: { id: 'user-1' } }, error: null });
    await expect(verifier.verify('t')).resolves.toBe(toUserId('user-1'));
  });

  it.each([
    [
      'a revoked session (403 session_not_found)',
      { message: 'gone', status: 403, code: 'session_not_found' },
    ],
    ['an invalid JWT (401 bad_jwt)', { message: 'bad', status: 401, code: 'bad_jwt' }],
    ['a missing session (400)', { message: 'Auth session missing!', status: 400 }],
  ])('returns null for %s', async (_label, error) => {
    const verifier = adapterWithGetUser({ data: { user: null }, error });
    await expect(verifier.verify('t')).resolves.toBeNull();
  });

  it('returns null when Auth answers without a user', async () => {
    const verifier = adapterWithGetUser({ data: { user: null }, error: null });
    await expect(verifier.verify('t')).resolves.toBeNull();
  });

  it.each([
    ['a network failure (no status)', { message: 'fetch failed' }],
    ['a network failure (status 0)', { message: 'fetch failed', status: 0 }],
    ['a provider 5xx', { message: 'upstream', status: 502 }],
  ])('throws DatabaseUnavailableError (503) for %s', async (_label, error) => {
    const verifier = adapterWithGetUser({ data: { user: null }, error });
    await expect(verifier.verify('t')).rejects.toBeInstanceOf(DatabaseUnavailableError);
  });

  it.each([
    ['429', { message: 'slow down', status: 429 }],
    [
      'an over_request_rate_limit code',
      { message: 'slow down', status: 400, code: 'over_request_rate_limit' },
    ],
  ])('throws AuthRateLimitedError (429) for %s', async (_label, error) => {
    const verifier = adapterWithGetUser({ data: { user: null }, error });
    await expect(verifier.verify('t')).rejects.toBeInstanceOf(AuthRateLimitedError);
  });

  it('retries once after a network failure and returns the user id', async () => {
    const verifier = adapterWithGetUser(NETWORK_ERROR, {
      data: { user: { id: 'user-1' } },
      error: null,
    });
    await expect(verifier.verify('t')).resolves.toBe(toUserId('user-1'));
    expect(verifier.calls()).toBe(2);
  });

  it('answers 503 when the retry also fails at the network level', async () => {
    const verifier = adapterWithGetUser(NETWORK_ERROR, NETWORK_ERROR);
    await expect(verifier.verify('t')).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(verifier.calls()).toBe(2);
  });

  it.each([
    ['a provider 5xx', { message: 'upstream', status: 502 }],
    ['a 429', { message: 'slow down', status: 429 }],
    ['an invalid JWT', { message: 'bad', status: 401, code: 'bad_jwt' }],
  ])('does not retry %s', async (_label, error) => {
    const verifier = adapterWithGetUser({ data: { user: null }, error });
    await verifier.verify('t').catch(() => undefined);
    expect(verifier.calls()).toBe(1);
  });
});
