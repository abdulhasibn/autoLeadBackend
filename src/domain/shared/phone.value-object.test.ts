import { describe, expect, it } from 'vitest';

import { Phone } from './phone.value-object';

describe('Phone value object', () => {
  it('accepts a valid E.164 phone number', () => {
    const phone = Phone.create('+919876543210');
    expect(phone.value).toBe('+919876543210');
  });

  it('strips surrounding whitespace', () => {
    const phone = Phone.create('  +919876543210  ');
    expect(phone.value).toBe('+919876543210');
  });

  it('rejects a number without + prefix', () => {
    expect(() => Phone.create('919876543210')).toThrow('E.164');
  });

  it('rejects an empty string', () => {
    expect(() => Phone.create('')).toThrow('E.164');
  });

  it('rejects a number with spaces inside', () => {
    expect(() => Phone.create('+91 987 654 3210')).toThrow('E.164');
  });

  it('rejects a number that is too short (< 8 chars total)', () => {
    expect(() => Phone.create('+1234')).toThrow('E.164');
  });

  it('rejects a number that is too long (> 15 chars total)', () => {
    expect(() => Phone.create('+1234567890123456')).toThrow('E.164');
  });

  it('considers two phones with the same number equal', () => {
    const a = Phone.create('+919876543210');
    const b = Phone.create('+919876543210');
    expect(a.equals(b)).toBe(true);
  });

  it('considers two phones with different numbers not equal', () => {
    const a = Phone.create('+919876543210');
    const b = Phone.create('+919876543211');
    expect(a.equals(b)).toBe(false);
  });
});
