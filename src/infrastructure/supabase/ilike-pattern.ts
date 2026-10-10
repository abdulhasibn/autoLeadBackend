import type { SearchTerm } from '../../domain/shared/search-term.value-object';

/** `ilike` pattern matching the term anywhere in the column. */
export function containsPattern(term: SearchTerm | string): string {
  return `%${typeof term === 'string' ? term : term.value}%`;
}

/** PostgREST `or()` filter: any of the columns contains the term. */
export function anyColumnContains(columns: readonly string[], term: SearchTerm | string): string {
  const pattern = containsPattern(term);
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',');
}
