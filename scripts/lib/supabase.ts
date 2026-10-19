import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../src/infrastructure/supabase/database.types';

export type Db = SupabaseClient<Database>;

/** Reads a required env var or exits with a clear message. */
export function requireEnv(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (value === '') {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

/** Service-role client for scripts; bypasses RLS, so never ship it to a client. */
export function serviceRoleClient(): Db {
  return createClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}

/**
 * Unwraps a Supabase result, throwing with context on error. Writes without
 * `.select()` succeed with null data; their callers ignore the return value.
 */
export function check<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  what: string,
): NonNullable<R['data']> {
  if (result.error) {
    throw new Error(`${what}: ${result.error.message}`);
  }
  return result.data as NonNullable<R['data']>;
}

/** Runs an async script entry point and exits non-zero on failure. */
export function run(main: () => Promise<void>): void {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
