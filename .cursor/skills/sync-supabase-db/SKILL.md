---
name: sync-supabase-db
description: >-
  Verify the hosted AutoLead Supabase database is in sync with the repo and
  the API code — no pending migrations, no hosted-only drift, generated
  types current, every table/RPC the API uses exists. Use when the user asks
  to sync the Supabase DB, check pending migrations, before merging/deploying
  backend changes, or after adding a migration.
disable-model-invocation: true
---

# Sync Supabase DB

Goal: **repo migrations = hosted migrations = `database.types.ts` = what `src/` calls.**
Report first; apply anything to hosted **only after the user confirms**.

## Constants

| | |
|---|---|
| Project | `autolead` · ref `pptljtbxqzmjossuamve` · `ap-south-1` |
| Migrations | `supabase/migrations/*.sql` (`<timestamp>_<name>.sql`) |
| Types | `src/infrastructure/supabase/database.types.ts` |
| Schema doc | `docs/schema.dbml` |
| DB calls | `.from('…')` / `.rpc('…')` — only under `src/**/infrastructure/` |
| Apply path | Supabase MCP `apply_migration` (project convention) |

## Checklist

```
- [ ] 1. Migrations: repo vs hosted (pending + hosted-only)
- [ ] 2. Types: fresh generate vs database.types.ts
- [ ] 3. API refs: every .from/.rpc name exists in types; pnpm typecheck
- [ ] 4. Deploy gap: hosted schema vs code on main (Vercel deploys main)
- [ ] 5. Fix (with confirmation) → re-run 1–3
- [ ] 6. Advisors (security) after any apply
- [ ] 7. PROGRESS.md: Supabase table + Log
```

## 1. Migrations

1. `ls supabase/migrations` → repo names (strip timestamp).
2. Supabase MCP `list_migrations` (ref above), or `supabase migration list --linked`.
3. **Match by name, not version** — MCP `apply_migration` stamps its own version, so versions can differ legitimately.
   - **Pending** = in repo, not hosted.
   - **Hosted-only** = in hosted, not repo (e.g. a hotfix). Must be folded into a repo file or a new migration, never ignored.

## 2. Types drift

MCP `generate_typescript_types` → write to scratchpad, run `pnpm exec prettier --stdin-filepath x.ts`, diff against `database.types.ts` (ignore the header comment). Any diff = drift: regenerate (keep the header) after migrations are in sync.

## 3. API ↔ DB

```bash
grep -rhoE "\.(from|rpc)\(\s*['\"][a-z_]+" src | sort -u
```

Each name must appear under `public.Tables` / `Views` / `Functions` in `database.types.ts`. Then `pnpm typecheck` (typed client catches column/arg mismatches). Flag any `.from`/`.rpc` outside `infrastructure/` as an architecture violation.

## 4. Deploy gap

Production runs `main`. Warn if hosted has a migration whose code is not on `main` (`git log main..HEAD -- supabase/migrations src`), or `main` code needs a migration not yet applied. Order: backward-compatible migration first, then merge.

## 5. Fix (confirm first — this is the production DB)

- Before applying: prefer a local replay (`supabase start` + `supabase db reset`) of all migrations.
- Apply each pending file in timestamp order via `apply_migration` with name = filename without timestamp and the file's exact SQL.
- Regenerate types; update `docs/schema.dbml` for touched tables.

## 6. Advisors

MCP `get_advisors` (security, then performance). Report new RLS / exposed-function warnings.

## Done

Short report: pending applied (names), hosted-only drift, types regenerated y/n, unknown table/RPC refs, typecheck pass, deploy gap, advisors. Update `docs/PROGRESS.md` (Supabase table "Migrations applied" + Log).
