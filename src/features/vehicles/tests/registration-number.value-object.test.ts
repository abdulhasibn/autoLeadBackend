import { describe, expect, it } from 'vitest';

import { RegistrationNumber } from '../domain/registration-number.value-object';

describe('RegistrationNumber', () => {
  it('normalizes spaces and case', () => {
    expect(RegistrationNumber.create('ka 01 ab 1234').value).toBe('KA01AB1234');
  });

  it.each(['QA-01-AB-0001', 'qa 01-ab 0001', 'QA.01/AB0001', 'QA01AB0001', ' QA01-AB0001 '])(
    'stores %j as one canonical plate',
    (input) => {
      expect(RegistrationNumber.create(input).value).toBe('QA01AB0001');
    },
  );

  it('rejects an empty value', () => {
    expect(() => RegistrationNumber.create('   ')).toThrow('cannot be empty');
  });

  it('rejects a value made only of separators', () => {
    expect(() => RegistrationNumber.create('---')).toThrow('cannot be empty');
  });

  it('measures the length after separators are removed', () => {
    expect(RegistrationNumber.create('AB-CD-EF-GH-IJ-KL-MN-OP').value).toBe('ABCDEFGHIJKLMNOP');
    expect(() => RegistrationNumber.create('ABCDEFGHIJKLMNOPQ')).toThrow('too long');
  });

  it('rejects symbols', () => {
    expect(() => RegistrationNumber.create('KA01@1234')).toThrow('alphanumeric');
  });
});
