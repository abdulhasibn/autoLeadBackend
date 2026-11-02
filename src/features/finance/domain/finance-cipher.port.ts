/**
 * Encrypts and decrypts finance row payloads with the unlocked data key.
 * `aad` binds a payload to its row (`<table>:<rowId>`) so ciphertext copied to
 * another row fails to open. Only `FinanceSessionService` hands one out.
 */
export interface FinanceCipher {
  readonly keyVersion: number;
  seal(plaintext: string, aad: string): string;
  /** Throws DataIntegrityError when the payload is altered or bound to another row. */
  open(sealed: string, aad: string): string;
}
