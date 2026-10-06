import type { Page, Pagination } from '../../shared/pagination/pagination';
import { toPage } from '../../shared/pagination/pagination';

/** PostgREST's code for an offset past the last row (HTTP 416). */
const RANGE_NOT_SATISFIABLE = 'PGRST103';

// e.g. "An offset of 40 was requested, but there are only 3 rows."
const TOTAL_PATTERN = /only (\d+) rows?/;

interface PostgrestErrorLike {
  readonly code?: string;
  readonly details?: string | null;
}

/**
 * An offset past the last row is a valid request for an empty page, not a
 * database failure. Returns that empty page (with the real total), or `null`
 * when the error is something else and should be handled by the caller.
 */
export function emptyPageIfPastEnd(
  error: PostgrestErrorLike,
  page: Pagination,
): Page<never> | null {
  if (error.code !== RANGE_NOT_SATISFIABLE) {
    return null;
  }
  const match = TOTAL_PATTERN.exec(error.details ?? '');
  if (match === null) {
    return null;
  }
  return toPage<never>([], Number(match[1]), page);
}
