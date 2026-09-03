# Soft delete via deleted_at

**Status:** accepted

Mutable business entities use `deleted_at timestamptz NULL` (null = live) instead of `is_deleted boolean`. Repositories exclude non-null `deleted_at` by default; partial uniques use `WHERE deleted_at IS NULL`. This preserves *when* a record was soft-deleted — relevant for support and audit — without changing soft-delete semantics. Lifecycle statuses remain for domain state; they do not replace soft delete. Append-only audit tables and frozen reference data MUST NOT use soft delete.

## Considered Options

- **Keep `is_deleted` only** — rejected: loses revocation/offboard timestamps.
- **Boolean plus optional `deleted_at` on some tables** — rejected: two conventions for the same idea.
