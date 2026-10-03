import { describe, expect, it } from 'vitest';

import { RegistrationNumber } from '../domain/registration-number.value-object';

describe('RegistrationNumber', () => {
  it('normalizes spaces and case', () => {
    expect(RegistrationNumber.create('ka 01 ab 1234').value).toBe('KA01AB1234');
  });

  it('rejects an empty value', () => {
    expect(() => RegistrationNumber.create('   ')).toThrow('cannot be empty');
  });

  it('rejects symbols', () => {
    expect(() => RegistrationNumber.create('KA01@1234')).toThrow('alphanumeric');
  });
});
