import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { toUserId } from '../../../domain/shared/user-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { SupabaseAuthAdapter } from '../infrastructure/supabase-auth.adapter';

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
