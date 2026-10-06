import { describe, expect, it } from 'vitest';

import { emptyPageIfPastEnd } from './range-not-satisfiable';

const page = { limit: 20, offset: 40 };

describe('emptyPageIfPastEnd', () => {
  it('returns an empty page with the real total for an offset past the end', () => {
    const error = {
      code: 'PGRST103',
      details: 'An offset of 40 was requested, but there are only 3 rows.',
    };

    expect(emptyPageIfPastEnd(error, page)).toEqual({ items: [], total: 3, limit: 20, offset: 40 });
  });

  it('handles an empty table', () => {
    const error = {
      code: 'PGRST103',
      details: 'An offset of 40 was requested, but there are only 0 rows.',
    };

    expect(emptyPageIfPastEnd(error, page)?.total).toBe(0);
  });

  it('ignores other errors', () => {
    expect(emptyPageIfPastEnd({ code: '08006', details: null }, page)).toBeNull();
  });

  it('ignores a range error whose total cannot be read', () => {
    expect(emptyPageIfPastEnd({ code: 'PGRST103', details: null }, page)).toBeNull();
  });
});
