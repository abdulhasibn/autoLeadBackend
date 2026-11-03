import { describe, expect, it } from 'vitest';

import { IndianMobile } from '../domain/indian-mobile.value-object';

describe('IndianMobile', () => {
  it.each([
    '9876543210',
    '98765 43210',
    '098765-43210',
    '+91 98765 43210',
    '+919876543210',
    '919876543210',
    '(+91) 98765.43210',
  ])('normalises %s to E.164', (input) => {
    expect(IndianMobile.parse(input)?.value).toBe('+919876543210');
  });

  it.each(['12345', '5876543210', '98765432101', '+14155550123', 'abcdefghij', ''])(
    'rejects %s',
    (input) => {
      expect(IndianMobile.parse(input)).toBeNull();
    },
  );
});
