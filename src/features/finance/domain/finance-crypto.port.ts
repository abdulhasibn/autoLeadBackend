import type { FinanceCipher } from './finance-cipher.port';

export interface KdfParams {
  readonly algorithm: 'scrypt';
  readonly n: number;
  readonly r: number;
  readonly p: number;
  readonly keyLength: number;
}

/**
 * Key handling for the finance vault (ADR-0014). Keys travel as `Uint8Array`;
 * salts, session secrets and wrapped keys as text so they can be stored and
 * sent as-is. Implemented with `node:crypto` in infrastructure.
 */
export interface FinanceCrypto {
  randomBytes(length: number): Uint8Array;
  /** A fresh random data key (DEK). */
  newDataKey(): Uint8Array;
  /** A fresh base64 salt for one key derivation. */
  newSalt(): string;
  /** A fresh base64url secret for one unlock session; never stored server-side. */
  newSessionSecret(): string;
  /** Slow, memory-hard derivation of a key-encryption key from a typed secret. */
  deriveKek(secret: string, salt: string, params: KdfParams): Promise<Uint8Array>;
  /** Fast derivation of a session key-encryption key from a random session secret. */
  deriveSessionKek(sessionSecret: string, sessionId: string): Uint8Array;
  /** Encrypts `key` under `kek`, bound to `aad`. */
  wrapKey(kek: Uint8Array, key: Uint8Array, aad: string): string;
  /** Returns null when `kek` or `aad` is wrong or `wrapped` was altered. */
  unwrapKey(kek: Uint8Array, wrapped: string, aad: string): Uint8Array | null;
  cipherFor(dataKey: Uint8Array, keyVersion: number): FinanceCipher;
}
