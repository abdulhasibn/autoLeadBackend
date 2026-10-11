import { describe, expect, it } from 'vitest';

import { createSupabaseAuthClient, createSupabaseInfraClient } from './supabase-client';

const CONFIG = {
  supabase: {
    url: 'https://example.supabase.co',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-key',
    jwtSecret: null,
  },
};

// The clients are shared across requests. A background refresh ticker would
// rotate the refresh token of whoever signed in last (see supabase-client.ts).
describe.each([
  ['auth', createSupabaseAuthClient],
  ['infra', createSupabaseInfraClient],
])('%s Supabase client', (_name, create) => {
  it('never persists or auto-refreshes a session', () => {
    const auth = create(CONFIG).auth as unknown as {
      autoRefreshToken: boolean;
      persistSession: boolean;
    };

    expect(auth.autoRefreshToken).toBe(false);
    expect(auth.persistSession).toBe(false);
  });
});
