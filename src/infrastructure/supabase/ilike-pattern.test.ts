import { describe, expect, it } from 'vitest';

import { SearchTerm } from '../../domain/shared/search-term.value-object';
import { anyColumnContains, containsPattern } from './ilike-pattern';

describe('ilike patterns', () => {
  it('wraps the term for a contains match', () => {
    expect(containsPattern(SearchTerm.create('creta'))).toBe('%creta%');
  });

  it('builds an or() filter over every column', () => {
    expect(anyColumnContains(['full_name', 'phone'], SearchTerm.create('98'))).toBe(
      'full_name.ilike.%98%,phone.ilike.%98%',
    );
  });
});
