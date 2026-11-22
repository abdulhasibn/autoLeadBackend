export const MAX_SEARCH_TERM_LENGTH = 100;

/**
 * Free text for a case-insensitive partial match on list endpoints.
 * Wildcard and filter-syntax characters carry no meaning in names, phones or
 * plates, so they are dropped rather than escaped; whitespace is collapsed.
 */
export class SearchTerm {
  private constructor(readonly value: string) {}

  static create(input: string): SearchTerm {
    if (input.trim().length > MAX_SEARCH_TERM_LENGTH) {
      throw new Error(`search must be at most ${MAX_SEARCH_TERM_LENGTH} characters`);
    }
    const cleaned = input
      .replace(/[%_*\\,()"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length === 0) {
      throw new Error('search must contain a letter or digit');
    }
    return new SearchTerm(cleaned);
  }

  /**
   * Like `create`, but a term with nothing searchable left (`%`, `(`, `"`)
   * means "no search" and gives undefined. An overlong term still throws.
   */
  static tryCreate(input: string): SearchTerm | undefined {
    try {
      return SearchTerm.create(input);
    } catch (err) {
      if (input.trim().length <= MAX_SEARCH_TERM_LENGTH) {
        return undefined;
      }
      throw err;
    }
  }

  /** The term split on spaces, for matching each word on its own. */
  get words(): readonly string[] {
    return this.value.split(' ');
  }
}
