import type { KdfParams } from './finance-crypto.port';

const MINUTE_MS = 60 * 1000;

/** Failed unlocks allowed inside the window before unlock is blocked. */
export const MAX_FAILED_UNLOCKS = 5;
/** A failure older than this no longer counts toward the limit. */
export const FAILED_UNLOCK_WINDOW_MS = 15 * MINUTE_MS;
export const UNLOCK_BLOCK_MS = 15 * MINUTE_MS;

export const SESSION_IDLE_MS = 30 * MINUTE_MS;
export const SESSION_ABSOLUTE_MS = 8 * 60 * MINUTE_MS;

/** The DEK in use. Rotation is out of scope, so this stays 1. */
export const CURRENT_KEY_VERSION = 1;

/** OWASP-minimum scrypt cost; about 128 MB and 0.3–0.5 s per derivation. */
export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: 'scrypt',
  n: 2 ** 17,
  r: 8,
  p: 1,
  keyLength: 32,
};

/** Longest date range one ledger list may cover. */
export const MAX_LEDGER_RANGE_DAYS = 366;
/** Most entries one list decrypts; beyond this the response says `truncated`. */
export const MAX_LEDGER_ROWS = 5000;
