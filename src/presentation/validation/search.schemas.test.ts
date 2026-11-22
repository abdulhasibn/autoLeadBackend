import { describe, expect, it } from 'vitest';

import { optionalSearchSchema } from './search.schemas';

describe('optionalSearchSchema', () => {
  it.each(['%', '_', '(', '"', '%_(', '   ', ''])('treats %j as no search', (input) => {
    expect(optionalSearchSchema.parse(input)).toBeUndefined();
  });

  it('is undefined when omitted', () => {
    expect(optionalSearchSchema.parse(undefined)).toBeUndefined();
  });

  it('keeps the searchable part of a term', () => {
    expect(optionalSearchSchema.parse(' a% b ')).toBe('a b');
  });

  it('still rejects an overlong term', () => {
    expect(optionalSearchSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });
});
