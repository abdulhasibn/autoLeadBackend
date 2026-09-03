import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AppConfig } from '../../config/environment';
import type { Database } from './database.types';

/**
 * The only file in the codebase that may call `createClient`.
 * Constructed once per process lifetime by the composition root and injected
 * into repositories — never imported directly by presentation/application/domain code.
 */
export function createSupabaseInfraClient(
  config: Pick<AppConfig, 'supabase'>,
): SupabaseClient<Database> {
  return createClient<Database>(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * This client only talks to Supabase Auth. Data repositories must always use
 * the service-role client above, wrapped in an authorization-aware use case.
 */
export function createSupabaseAuthClient(
  config: Pick<AppConfig, 'supabase'>,
): SupabaseClient<Database> {
  return createClient<Database>(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false },
  });
}
