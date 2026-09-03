/**
 * Generic, framework-neutral Result wrapper for operations where returning an
 * error value (rather than throwing) is more ergonomic for the caller.
 */
export type Result<T, E = Error> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
