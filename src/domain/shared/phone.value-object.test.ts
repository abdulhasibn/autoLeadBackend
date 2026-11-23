import { describe, expect, it } from 'vitest';

import { Phone } from './phone.value-object';

describe('Phone.createIndianMobile', () => {
  it('accepts mobiles starting 6-9 and normalises to +91', () => {
    expect(Phone.createIndianMobile('+919876543210').value).toBe('+919876543210');
    expect(Phone.createIndianMobile('98765 43210').value).toBe('+919876543210');
    expect(Phone.createIndianMobile('6000000000').value).toBe('+916000000000');
  });

  it('rejects landlines, short, foreign and empty numbers', () => {
    for (const bad of ['5876543210', '+911234567890', '+14155550123', '98765', '']) {
      expect(() => Phone.createIndianMobile(bad)).toThrow('10-digit mobile');
    }
  });

  it('leaves Phone.create lenient so stored non-mobile rows still load', () => {
    expect(Phone.create('+14155550123').value).toBe('+14155550123');
  });
});

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
