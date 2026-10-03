import { describe, expect, it } from 'vitest';

import { Email } from './email.value-object';

describe('Email value object', () => {
  it('accepts a valid address and lowercases it', () => {
    const email = Email.create('Ada@Example.COM');
    expect(email.value).toBe('ada@example.com');
  });

  it('strips surrounding whitespace', () => {
    const email = Email.create('  ada@example.com  ');
    expect(email.value).toBe('ada@example.com');
  });

  it('rejects an empty string', () => {
    expect(() => Email.create('')).toThrow('valid email');
  });

  it('rejects a value without @', () => {
    expect(() => Email.create('ada.example.com')).toThrow('valid email');
  });

  it('rejects a value without a domain dot', () => {
    expect(() => Email.create('ada@localhost')).toThrow('valid email');
  });

  it('rejects an address longer than 255 characters', () => {
    const local = 'a'.repeat(64);
    const domain = `${'b'.repeat(190)}.com`;
    expect(() => Email.create(`${local}@${domain}`)).toThrow('valid email');
  });

  it('considers two equal addresses equal after normalisation', () => {
    const a = Email.create('ADA@example.com');
    const b = Email.create('ada@example.com');
    expect(a.equals(b)).toBe(true);
  });

  it('considers different addresses not equal', () => {
    const a = Email.create('ada@example.com');
    const b = Email.create('grace@example.com');
    expect(a.equals(b)).toBe(false);
  });
});
