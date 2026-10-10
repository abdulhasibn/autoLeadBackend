import { describe, expect, it } from 'vitest';

import { SearchTerm } from './search-term.value-object';

describe('SearchTerm', () => {
  it('trims and collapses whitespace', () => {
    expect(SearchTerm.create('  Hyundai   Creta ').value).toBe('Hyundai Creta');
  });

  it('drops wildcard and filter-syntax characters', () => {
    expect(SearchTerm.create('50%_off,(x)"*\\').value).toBe('50 off x');
  });

  it("keeps apostrophes and dots so names like O'Brien still match", () => {
    expect(SearchTerm.create("J. O'Brien").value).toBe("J. O'Brien");
  });

  it('splits into words', () => {
    expect(SearchTerm.create('swift ka01').words).toEqual(['swift', 'ka01']);
  });

  it('rejects a term with nothing searchable', () => {
    expect(() => SearchTerm.create('%%')).toThrow();
  });

  it('rejects an overlong term', () => {
    expect(() => SearchTerm.create('a'.repeat(101))).toThrow();
  });
});
