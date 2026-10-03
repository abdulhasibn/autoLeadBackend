import { describe, expect, it } from 'vitest';

import { Password } from './password.value-object';

describe('Password value object', () => {
  it('accepts a password of 8 or more characters', () => {
    const password = Password.create('secret12');
    expect(password.value).toBe('secret12');
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() => Password.create('short')).toThrow('at least 8 characters');
  });

  it('does not trim — surrounding spaces count toward length', () => {
    expect(() => Password.create('  ab  ')).toThrow('at least 8 characters');
    expect(Password.create('  abcd  ').value).toBe('  abcd  ');
  });
});
