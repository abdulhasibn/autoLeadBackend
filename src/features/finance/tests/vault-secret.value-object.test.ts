import { describe, expect, it } from 'vitest';

import { FinanceKey, RecoveryKey } from '../domain/vault-secret.value-object';

const FIFTEEN_BYTES = new Uint8Array(15).map((_, i) => i * 17);
const THIRTY_TWO_BYTES = new Uint8Array(32).map((_, i) => 255 - i * 7);

describe('FinanceKey', () => {
  it('renders 15 random bytes as FK- plus six groups of four', () => {
    const key = FinanceKey.fromBytes(FIFTEEN_BYTES);

    expect(key.value).toMatch(/^FK(-[0-9A-HJKMNP-TV-Z]{4}){6}$/);
  });

  it('accepts the key typed back with different case, spacing and look-alikes', () => {
    const key = FinanceKey.fromBytes(FIFTEEN_BYTES);
    const sloppy = ` ${key.value.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l')} `;

    expect(FinanceKey.create(sloppy).value).toBe(key.value);
    expect(FinanceKey.create(key.value.slice(3)).value).toBe(key.value);
  });

  it('rejects the wrong prefix, wrong length or foreign characters', () => {
    const key = FinanceKey.fromBytes(FIFTEEN_BYTES);

    expect(() => FinanceKey.create(key.value.replace('FK', 'RK'))).toThrow();
    expect(() => FinanceKey.create(key.value.slice(0, -1))).toThrow();
    expect(() => FinanceKey.create(`${key.value.slice(0, -1)}U`)).toThrow();
    expect(() => FinanceKey.create('')).toThrow();
  });

  it('refuses the wrong number of random bytes', () => {
    expect(() => FinanceKey.fromBytes(new Uint8Array(16))).toThrow();
  });
});

describe('RecoveryKey', () => {
  it('renders 32 random bytes as RK- plus thirteen groups of four', () => {
    const key = RecoveryKey.fromBytes(THIRTY_TWO_BYTES);

    expect(key.value).toMatch(/^RK(-[0-9A-HJKMNP-TV-Z]{4}){13}$/);
    expect(RecoveryKey.create(key.value.toLowerCase()).value).toBe(key.value);
  });

  it('does not accept a finance key', () => {
    expect(() => RecoveryKey.create(FinanceKey.fromBytes(FIFTEEN_BYTES).value)).toThrow();
  });
});
