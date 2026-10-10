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

  /** The term split on spaces, for matching each word on its own. */
  get words(): readonly string[] {
    return this.value.split(' ');
  }
}
