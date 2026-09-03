import { describe, expect, it } from 'vitest';

import { formatServerTimingHeader } from './request-spans';

describe('formatServerTimingHeader', () => {
  it('emits known spans in auth / policy / query / total order', () => {
    expect(
      formatServerTimingHeader({
        total: 40,
        query: 15,
        auth: 12,
        policy: 8,
      }),
    ).toBe('auth;dur=12, policy;dur=8, query;dur=15, total;dur=40');
  });

  it('omits missing spans', () => {
    expect(formatServerTimingHeader({ total: 3 })).toBe('total;dur=3');
  });
});
