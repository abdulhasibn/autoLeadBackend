import { describe, expect, it } from 'vitest';

import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { NodeFinanceCrypto } from '../infrastructure/node-finance-crypto';
import { TEST_KDF } from './fakes';

const crypto = new NodeFinanceCrypto();
const AAD = 'finance_vault:finance';

describe('NodeFinanceCrypto key wrapping', () => {
  it('unwraps a key wrapped under a derived KEK', async () => {
    const salt = crypto.newSalt();
    const kek = await crypto.deriveKek('FK-SECRET', salt, TEST_KDF);
    const dataKey = crypto.newDataKey();

    const wrapped = crypto.wrapKey(kek, dataKey, AAD);
    const again = await crypto.deriveKek('FK-SECRET', salt, TEST_KDF);

    expect(crypto.unwrapKey(again, wrapped, AAD)).toEqual(dataKey);
    expect(wrapped).toMatch(/^v1\./);
  });

  it('returns null for a wrong secret, a wrong AAD or a tampered wrap', async () => {
    const salt = crypto.newSalt();
    const kek = await crypto.deriveKek('FK-SECRET', salt, TEST_KDF);
    const wrongKek = await crypto.deriveKek('FK-OTHER', salt, TEST_KDF);
    const wrapped = crypto.wrapKey(kek, crypto.newDataKey(), AAD);
    const body = Buffer.from(wrapped.slice(3), 'base64');
    body[20] = (body[20] ?? 0) ^ 0xff;

    expect(crypto.unwrapKey(wrongKek, wrapped, AAD)).toBeNull();
    expect(crypto.unwrapKey(kek, wrapped, 'finance_vault:recovery')).toBeNull();
    expect(crypto.unwrapKey(kek, `v1.${body.toString('base64')}`, AAD)).toBeNull();
    expect(crypto.unwrapKey(kek, 'v2.abc', AAD)).toBeNull();
  });

  it('derives the same session KEK for the same secret and session only', () => {
    const secret = crypto.newSessionSecret();
    const a = crypto.deriveSessionKek(secret, 'session-a');

    expect(crypto.deriveSessionKek(secret, 'session-a')).toEqual(a);
    expect(crypto.deriveSessionKek(secret, 'session-b')).not.toEqual(a);
    expect(crypto.deriveSessionKek(crypto.newSessionSecret(), 'session-a')).not.toEqual(a);
  });
});

describe('NodeAesGcmCipher', () => {
  const dataKey = crypto.newDataKey();
  const cipher = crypto.cipherFor(dataKey, 1);
  const rowAad = 'finance_entries:11111111-1111-4111-8111-000000000001';

  it('round-trips a payload and versions it', () => {
    const sealed = cipher.seal('{"amount":50000000}', rowAad);

    expect(sealed).toMatch(/^v1\.1\./);
    expect(cipher.open(sealed, rowAad)).toBe('{"amount":50000000}');
  });

  it('never repeats ciphertext for the same plaintext', () => {
    expect(cipher.seal('same', rowAad)).not.toBe(cipher.seal('same', rowAad));
  });

  it('pads so short and long amounts have the same ciphertext length', () => {
    const short = cipher.seal('{"amount":1}', rowAad);
    const long = cipher.seal('{"amount":5000000000}', rowAad);

    expect(short.length).toBe(long.length);
  });

  it('round-trips a payload longer than one padding bucket', () => {
    const note = 'x'.repeat(600);

    expect(cipher.open(cipher.seal(note, rowAad), rowAad)).toBe(note);
  });

  it('refuses a payload moved to another row, altered, or from another key', () => {
    const sealed = cipher.seal('{"amount":1}', rowAad);
    const [version, keyVersion, body] = sealed.split('.');
    const bytes = Buffer.from(body ?? '', 'base64');
    bytes[15] = (bytes[15] ?? 0) ^ 0x01;
    const other = crypto.cipherFor(crypto.newDataKey(), 1);

    expect(() => cipher.open(sealed, 'finance_entries:another-row')).toThrow(DataIntegrityError);
    expect(() =>
      cipher.open(`${version}.${keyVersion}.${bytes.toString('base64')}`, rowAad),
    ).toThrow(DataIntegrityError);
    expect(() => other.open(sealed, rowAad)).toThrow(DataIntegrityError);
    expect(() => crypto.cipherFor(dataKey, 2).open(sealed, rowAad)).toThrow(DataIntegrityError);
  });

  it('does not put the payload in the integrity error', () => {
    const sealed = cipher.seal('{"amount":424242}', rowAad);

    try {
      cipher.open(sealed, 'finance_entries:another-row');
      expect.unreachable();
    } catch (err) {
      expect(String((err as Error).message)).not.toContain('424242');
    }
  });
});
