#!/usr/bin/env bash
# Dump a Supabase Postgres database, encrypt the dump with age, and upload it
# with rclone. Runs in .github/workflows/db-backup.yml. Can also run by hand.
#
# Required env:
#   DB_URL          Postgres connection string (Supabase session pooler, port 5432)
#   AGE_RECIPIENT   age public key (age1...). Only the matching private key can decrypt.
#   RCLONE_REMOTE   rclone destination, e.g. gdrive:autolead-backups/prod
# Optional env:
#   BACKUP_REASON   scheduled | manual | pre-migration   (default: manual)
#   BACKUP_LABEL    file-name prefix                      (default: autolead-prod)
#   KEEP_HOURLY_DAYS (7)  KEEP_DAILY_DAYS (30)  KEEP_ADHOC_DAYS (90); monthly kept forever
#   STORAGE_SRC     rclone path of Supabase Storage (S3), e.g. sbs3:   (skip if unset)
#   STORAGE_DST     rclone path for the storage mirror, e.g. gcrypt:    (required with STORAGE_SRC)
#
# Archive layout (<label>-<UTC timestamp>-<reason>.tar.zst.age):
#   roles.sql schema.sql data.sql   supabase db dump output (Supabase's documented restore format)
#   manifest.tsv                    exact row count of every table, checked after a restore
#   migrations.tsv                  supabase_migrations.schema_migrations at dump time
#   meta.env                        timestamp, reason, git sha, server version
set -euo pipefail

: "${DB_URL:?DB_URL is required}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"
: "${RCLONE_REMOTE:?RCLONE_REMOTE is required}"
REASON="${BACKUP_REASON:-manual}"
LABEL="${BACKUP_LABEL:-autolead-prod}"
case "$REASON" in scheduled | manual | pre-migration) ;; *)
  echo "BACKUP_REASON must be scheduled, manual or pre-migration" >&2
  exit 2
  ;;
esac

ts="$(date -u +%Y-%m-%dT%H%MZ)"
hour="$(date -u +%H)"
day="$(date -u +%d)"
name="${LABEL}-${ts}-${REASON}.tar.zst.age"
work="$(mktemp -d)"
out="$(mktemp -d)"
trap 'rm -rf "$work" "$out"' EXIT

log() { printf '\n== %s\n' "$*"; }

log "Dumping roles, schema and data"
supabase db dump --db-url "$DB_URL" --role-only -f "$work/roles.sql"
supabase db dump --db-url "$DB_URL" -f "$work/schema.sql"
supabase db dump --db-url "$DB_URL" --data-only --use-copy -f "$work/data.sql"

log "Recording row counts and migration history"
psql "$DB_URL" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 >"$work/manifest.tsv" <<'SQL'
select format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p') and n.nspname in ('public', 'auth', 'storage')
order by 1
\gexec
SQL
psql "$DB_URL" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 \
  -c 'select version, name from supabase_migrations.schema_migrations order by version' \
  >"$work/migrations.tsv"
{
  echo "BACKUP_TIMESTAMP=$ts"
  echo "BACKUP_REASON=$REASON"
  echo "GIT_SHA=${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
  echo "SERVER_VERSION=\"$(psql "$DB_URL" -X -At -c 'show server_version')\""
} >"$work/meta.env"

tables="$(wc -l <"$work/manifest.tsv" | tr -d ' ')"
rows="$(awk -F'\t' '{s += $2} END {print s + 0}' "$work/manifest.tsv")"
[ "$tables" -gt 0 ] || {
  echo "Manifest is empty; refusing to upload a suspicious dump" >&2
  exit 1
}

log "Compressing and encrypting"
tar -C "$work" -cf - . | zstd -q -19 | age -r "$AGE_RECIPIENT" >"$out/$name"
(cd "$out" && sha256sum "$name" >"$name.sha256" 2>/dev/null || shasum -a 256 "$name" >"$name.sha256")
size="$(du -h "$out/$name" | cut -f1)"

# Where this backup goes. Scheduled runs land in hourly/; the 00 UTC run also
# goes to daily/, and on the 1st of the month to monthly/.
dests=()
if [ "$REASON" = scheduled ]; then
  dests+=(hourly)
  if [ "$hour" = 00 ]; then dests+=(daily); fi
  if [ "$hour" = 00 ] && [ "$day" = 01 ]; then dests+=(monthly); fi
else
  dests+=("$REASON")
fi

for d in "${dests[@]}"; do
  log "Uploading to $RCLONE_REMOTE/$d/"
  rclone copy "$out" "$RCLONE_REMOTE/$d/" --include "$name*"
  rclone lsf "$RCLONE_REMOTE/$d/" --include "$name" | grep -qx "$name" ||
    {
      echo "Upload to $d/ could not be verified" >&2
      exit 1
    }
done

if [ -n "${STORAGE_SRC:-}" ]; then
  : "${STORAGE_DST:?STORAGE_DST is required with STORAGE_SRC}"
  log "Mirroring Supabase Storage (deleted/overwritten files kept under storage-deleted/$ts)"
  rclone sync "$STORAGE_SRC" "$STORAGE_DST/current" --backup-dir "$STORAGE_DST/deleted/$ts" --fast-list
fi

log "Applying retention"
rclone delete "$RCLONE_REMOTE/hourly" --min-age "${KEEP_HOURLY_DAYS:-7}d" || true
rclone delete "$RCLONE_REMOTE/daily" --min-age "${KEEP_DAILY_DAYS:-30}d" || true
rclone delete "$RCLONE_REMOTE/manual" --min-age "${KEEP_ADHOC_DAYS:-90}d" || true
rclone delete "$RCLONE_REMOTE/pre-migration" --min-age "${KEEP_ADHOC_DAYS:-90}d" || true

summary="Backup **$name** ($size, $tables tables, $rows rows) → ${dests[*]}"
echo
echo "$summary"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$summary" >>"$GITHUB_STEP_SUMMARY"; fi
if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "archive=$name" >>"$GITHUB_OUTPUT"; fi
