import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import type { FinanceCipher } from '../domain/finance-cipher.port';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PAYLOAD_VERSION = 'v1';
/** Plaintext is padded to a multiple of this, so length doesn't reveal amounts. */
const PAD_BUCKET = 256;
const PAD_MARKER = 0x80;

/**
 * AES-256-GCM over finance row payloads with the unlocked data key.
 * Format: `v1.<keyVersion>.<base64(iv ‖ ciphertext ‖ tag)>`. Plaintext gets
 * ISO/IEC 7816-4 padding (0x80 then zeros) up to the next 256-byte bucket.
 */
export class NodeAesGcmCipher implements FinanceCipher {
  private readonly key: Buffer;

  constructor(
    dataKey: Uint8Array,
    readonly keyVersion: number,
  ) {
    this.key = Buffer.from(dataKey);
  }

  seal(plaintext: string, aad: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv, { authTagLength: TAG_LENGTH });
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(pad(Buffer.from(plaintext, 'utf8'))),
      cipher.final(),
    ]);
    const packed = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
    return `${PAYLOAD_VERSION}.${this.keyVersion}.${packed.toString('base64')}`;
  }

  open(sealed: string, aad: string): string {
    const [version, keyVersion, body] = sealed.split('.');
    if (
      version !== PAYLOAD_VERSION ||
      keyVersion !== String(this.keyVersion) ||
      body === undefined
    ) {
      throw integrityError(aad);
    }
    const packed = Buffer.from(body, 'base64');
    if (packed.length <= IV_LENGTH + TAG_LENGTH) {
      throw integrityError(aad);
    }
    let padded: Buffer;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, packed.subarray(0, IV_LENGTH), {
        authTagLength: TAG_LENGTH,
      });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(packed.subarray(packed.length - TAG_LENGTH));
      padded = Buffer.concat([
        decipher.update(packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH)),
        decipher.final(),
      ]);
    } catch (cause) {
      throw integrityError(aad, cause);
    }
    return unpad(padded, aad).toString('utf8');
  }
}

function pad(plain: Buffer): Buffer {
  const length = Math.ceil((plain.length + 1) / PAD_BUCKET) * PAD_BUCKET;
  const padded = Buffer.alloc(length);
  plain.copy(padded);
  padded[plain.length] = PAD_MARKER;
  return padded;
}

function unpad(padded: Buffer, aad: string): Buffer {
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) {
    end -= 1;
  }
  if (end < 0 || padded[end] !== PAD_MARKER) {
    throw integrityError(aad);
  }
  return padded.subarray(0, end);
}

/** Names the row only; never the payload. */
function integrityError(aad: string, cause?: unknown): DataIntegrityError {
  return new DataIntegrityError(`Finance record ${aad} failed to decrypt`, { cause });
}
