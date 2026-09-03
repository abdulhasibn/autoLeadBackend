/**
 * Generic pagination primitives used by query interfaces across every feature.
 */
export interface Pagination {
  readonly limit: number;
  readonly offset: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function toPage<T>(items: readonly T[], total: number, page: Pagination): Page<T> {
  return { items, total, limit: page.limit, offset: page.offset };
}
