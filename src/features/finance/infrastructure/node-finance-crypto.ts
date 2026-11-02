import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  scrypt,
  type ScryptOptions,
} from 'node:crypto';

import type { FinanceCipher } from '../domain/finance-cipher.port';
import type { FinanceCrypto, KdfParams } from '../domain/finance-crypto.port';
import { NodeAesGcmCipher } from './node-aes-gcm.cipher';

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const WRAP_VERSION = 'v1';
const SESSION_HKDF_INFO = 'autolead-finance-session-v1';

/**
 * `node:crypto` implementation of the finance key handling (ADR-0014):
 * scrypt for typed secrets, HKDF-SHA256 for session secrets, AES-256-GCM for
 * key wraps. Wrapped keys are `v1.<base64(iv ‖ ciphertext ‖ tag)>`.
 */
export class NodeFinanceCrypto implements FinanceCrypto {
  randomBytes(length: number): Uint8Array {
    return new Uint8Array(randomBytes(length));
  }

  newDataKey(): Uint8Array {
    return this.randomBytes(KEY_LENGTH);
  }

  newSalt(): string {
    return randomBytes(16).toString('base64');
  }

  newSessionSecret(): string {
    return randomBytes(32).toString('base64url');
  }

  deriveKek(secret: string, salt: string, params: KdfParams): Promise<Uint8Array> {
    const options: ScryptOptions = {
      N: params.n,
      r: params.r,
      p: params.p,
      // scrypt needs about 128·N·r bytes; leave headroom over Node's 32 MB default.
      maxmem: 256 * params.n * params.r,
    };
    return new Promise((resolve, reject) => {
      scrypt(secret, Buffer.from(salt, 'base64'), params.keyLength, options, (err, key) => {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve(new Uint8Array(key));
      });
    });
  }

  deriveSessionKek(sessionSecret: string, sessionId: string): Uint8Array {
    return new Uint8Array(
      hkdfSync(
        'sha256',
        Buffer.from(sessionSecret, 'base64url'),
        Buffer.from(sessionId, 'utf8'),
        SESSION_HKDF_INFO,
        KEY_LENGTH,
      ),
    );
  }

  wrapKey(kek: Uint8Array, key: Uint8Array, aad: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', kek, iv, { authTagLength: TAG_LENGTH });
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(key), cipher.final()]);
    const packed = Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
    return `${WRAP_VERSION}.${packed.toString('base64')}`;
  }

  unwrapKey(kek: Uint8Array, wrapped: string, aad: string): Uint8Array | null {
    const [version, body] = wrapped.split('.');
    if (version !== WRAP_VERSION || body === undefined) {
      return null;
    }
    const packed = Buffer.from(body, 'base64');
    if (packed.length <= IV_LENGTH + TAG_LENGTH) {
      return null;
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', kek, packed.subarray(0, IV_LENGTH), {
        authTagLength: TAG_LENGTH,
      });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(packed.subarray(packed.length - TAG_LENGTH));
      const key = Buffer.concat([
        decipher.update(packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH)),
        decipher.final(),
      ]);
      return new Uint8Array(key);
    } catch {
      return null;
    }
  }

  cipherFor(dataKey: Uint8Array, keyVersion: number): FinanceCipher {
    return new NodeAesGcmCipher(dataKey, keyVersion);
  }
}
