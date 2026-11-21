import type { Database } from './database.types';

type Functions = Database['public']['Functions'];

/** Every arg may also be `null`. */
export type NullableArgs<T> = { [K in keyof T]: T[K] | null };

/**
 * Args for `db.rpc(name, rpcArgs<name>({ … }))` where any arg may be `null`.
 *
 * The Supabase type generator types every function arg as non-null, but our
 * functions are not STRICT and take SQL NULL for optional values. This only
 * widens the compile-time type; the object is passed through unchanged.
 */
export function rpcArgs<F extends keyof Functions>(
  args: NullableArgs<Functions[F]['Args']>,
): Functions[F]['Args'] {
  return args as Functions[F]['Args'];
}
