#!/usr/bin/env bash
# Restore a backup made by backup.sh into a Postgres database, then check that
# every table's row count matches the manifest recorded at dump time.
#
# Usage: scripts/backup/restore.sh <archive.tar.zst.age>
#
# Env:
#   AGE_IDENTITY_FILE  path to the age private key (required)
#   TARGET_DB_URL      where to restore (default: local `supabase start` DB)
#   ALLOW_REMOTE_RESTORE=<target host>
#                      required to restore anywhere but localhost. Restoring
#                      over a live database is a human decision; see the
#                      db-restore skill.
#
# The target must be a FRESH Supabase database (new project, or a local
# `supabase start` with no migrations applied). This script does not drop
# anything first.
set -euo pipefail

archive="${1:?usage: restore.sh <archive.tar.zst.age>}"
: "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE is required}"
TARGET_DB_URL="${TARGET_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

host="$(printf '%s' "$TARGET_DB_URL" | sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#')"
case "$host" in
  127.0.0.1 | localhost | ::1) ;;
  *)
    if [ "${ALLOW_REMOTE_RESTORE:-}" != "$host" ]; then
      echo "Refusing to restore into non-local host '$host'." >&2
      echo "Set ALLOW_REMOTE_RESTORE=$host only after the user has confirmed the target." >&2
      exit 2
    fi
    ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [ -f "$archive.sha256" ]; then
  (cd "$(dirname "$archive")" && { sha256sum -c "$(basename "$archive").sha256" 2>/dev/null ||
    shasum -a 256 -c "$(basename "$archive").sha256"; })
fi

echo "== Decrypting and extracting"
age -d -i "$AGE_IDENTITY_FILE" "$archive" | zstd -q -d | tar -C "$work" -xf -
cat "$work/meta.env"

echo "== Restoring roles, schema and data into $host"
psql "$TARGET_DB_URL" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  -f "$work/roles.sql" \
  -c 'SET session_replication_role = replica' \
  -f "$work/schema.sql" \
  -f "$work/data.sql"

echo "== Verifying row counts against the manifest"
mismatch=0
checked=0
while IFS=$'\t' read -r table expected; do
  [ -n "$table" ] || continue
  schema="${table%%.*}"
  rel="${table#*.}"
  actual="$(psql "$TARGET_DB_URL" -X -At -v ON_ERROR_STOP=1 \
    -c "select count(*) from \"$schema\".\"$rel\"" 2>/dev/null || echo missing)"
  checked=$((checked + 1))
  if [ "$actual" != "$expected" ]; then
    echo "MISMATCH $table: expected $expected, got $actual"
    mismatch=$((mismatch + 1))
  fi
done <"$work/manifest.tsv"

rows="$(awk -F'\t' '{s += $2} END {print s + 0}' "$work/manifest.tsv")"
if [ "$mismatch" -gt 0 ]; then
  echo "Restore verification FAILED: $mismatch of $checked tables differ." >&2
  exit 1
fi
summary="Restore verified: $checked tables, $rows rows match the manifest ($(basename "$archive"))."
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$summary" >>"$GITHUB_STEP_SUMMARY"; fi
