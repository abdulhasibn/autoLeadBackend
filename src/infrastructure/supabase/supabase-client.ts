import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AppConfig } from '../../config/environment';
import type { Database } from './database.types';

/**
 * Both clients are shared by every request, so they must never hold a user
 * session. Outside a browser, auth-js runs a background refresh ticker by
 * default (`autoRefreshToken`). On a shared client it would rotate the refresh
 * token of whoever signed in last, so that user's next refresh fails.
 */
export const STATELESS_AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/**
 * The only file in the codebase that may call `createClient`.
 * Constructed once per process lifetime by the composition root and injected
 * into repositories — never imported directly by presentation/application/domain code.
 */
export function createSupabaseInfraClient(
  config: Pick<AppConfig, 'supabase'>,
): SupabaseClient<Database> {
  return createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: STATELESS_AUTH_OPTIONS,
  });
}

/**
 * This client only talks to Supabase Auth. Data repositories must always use
 * the service-role client above, wrapped in an authorization-aware use case.
 *
 * Never call session-bound methods on it (`auth.signOut()`, `auth.updateUser()`,
 * `auth.getSession()`): it is shared across requests. Pass the user's JWT or id
 * explicitly instead (`auth.admin.signOut(jwt)`, `auth.getUser(jwt)`).
 */
export function createSupabaseAuthClient(
  config: Pick<AppConfig, 'supabase'>,
): SupabaseClient<Database> {
  return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: STATELESS_AUTH_OPTIONS,
  });
}
