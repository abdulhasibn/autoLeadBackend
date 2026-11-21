import { describe, expect, it } from 'vitest';

import { addToSpan, enterRequestSpans, formatServerTimingHeader } from './request-spans';

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

describe('addToSpan', () => {
  it('sums repeated work into one span inside a request', () => {
    const store = enterRequestSpans();

    addToSpan('query', 10.4);
    addToSpan('query', 5.2);

    expect(store.spans.query).toBe(15);
  });
});
