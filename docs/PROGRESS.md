# Project Progress Log

> **Agents:** Read the **Current stage** section first. Append a new log entry when you complete a meaningful chunk of work (schema, feature, infra). Keep entries newest-first under the log. Do not rewrite history — only amend **Current stage** / **Next up**.

## Current stage

**Stage:** **Stint 1 Identity** — full DB schema landed on hosted Supabase; auth feature next.

| Area | Status |
|------|--------|
| Repo scaffold (Express / TS / Vitest / CI) | Done |
| Architecture docs + ADR-0001 / ADR-0005 | Done |
| Cursor rules (architecture, quality, errors, testing, database, git) | Done |
| Supabase project | Done (`autolead`, `ap-south-1`) |
| SQL migrations (stints 1–6) | Done — applied to hosted project |
| Schema source of truth (`docs/schema.dbml`) | Done |
| Generated `database.types.ts` | Done |
| Local `.env` with service role key | Local dev only — not committed |
| Auth feature (`src/features/auth`) | Not started |
| Users / roles (`src/features/users`) | Not started |
| Owners (`src/features/owners`) | Not started |
| Vehicles (`src/features/vehicles`) | Not started |
| Inventory (`src/features/inventory`) | Not started |
| Marketplace (`src/features/marketplace`) | Not started |
| Leads (`src/features/leads`) | Not started |
| Sales (`src/features/sales`) | Not started |
| Finance (`src/features/finance`) | Not started |
| Notifications (`src/features/notifications`) | Not started |
| Audit trail (cross-cutting) | Not started |
| HTTP integration tests (local Docker Supabase) | Not started |
| Vercel production host | Not started |

**Supabase project**

| Field | Value |
|-------|-------|
| Name | `autolead` |
| Ref | `pptljtbxqzmjossuamve` |
| Region | `ap-south-1` (Mumbai) |
| URL | `https://pptljtbxqzmjossuamve.supabase.co` |
| Dashboard | [Project settings](https://supabase.com/dashboard/project/pptljtbxqzmjossuamve) |
| Tables | 25 |
| Migrations applied | 6 (stint1–stint6) |
| Roles seeded | admin, salesperson, owner, buyer |

## Next up

1. Enable Custom Access Token Hook in hosted dashboard (Auth → Hooks → `private.custom_access_token_hook`).
2. Wire local `.env` with service-role + anon keys.
3. Auth feature module (`src/features/auth`) — OTP / session, Bearer middleware, `/auth/me`.
4. Users feature — staff CRUD + role assignment (Admin).

## Log

### 2026-09-03 — Architecture skills (orient, follow-architecture, compliance)

- Added project skills under `.cursor/skills/`:
  - `orient/SKILL.md` — read `docs/PROGRESS.md` and task-scoped docs before planning or implementing
  - `follow-architecture/SKILL.md` — enforce Clean Architecture and code-quality when writing `src/`
  - `architecture-compliance/SKILL.md` + `pitfalls.md` — audit plans/diffs for H1–H12 hard-rejects (CQRS, layers, composition, shared IDs)
- Skills authored for AutoLead only (vehicles, owners, leads, scoped persistence, ADR-0001/0005).
- Deferred: sync-postman, sync-docs, database-design skills.

### 2026-09-02 — Full database schema (stints 1–6)

- Wrote complete source of truth in `docs/schema.dbml` (identity, catalog, owners, vehicles, buyers, contacts, leads, finance, audit, notifications).
- Added six forward migrations under `supabase/migrations/` and applied them to hosted project `pptljtbxqzmjossuamve` via Supabase MCP.
- Seeded frozen `roles` catalog; created `private.custom_access_token_hook` (injects `app_metadata.roles`).
- Enabled local hook wiring in `supabase/config.toml`; hosted hook still needs dashboard enablement.
- Regenerated `src/infrastructure/supabase/database.types.ts` from live schema.
- RLS enabled on all public tables (deny-by-default for anon/authenticated; service-role API is authz authority). Feature-scoped RLS policies deferred per roadmap.
- Deferred: catalog seed data, contact→user merge procedure, owner `id_info` encryption, Auth feature module.

### 2026-09-02 — Supabase project created

- Created cloud project **autolead** via Supabase MCP (`ref`: `pptljtbxqzmjossuamve`, region `ap-south-1`, status `ACTIVE_HEALTHY`).
- Recorded project metadata in this log; no migrations or schema yet.
- Deferred: `docs/schema.dbml` design, first migration, `.env` service-role key (dashboard → API settings).

### 2026-09-02 — Backend scaffold

- Express/TypeScript shell: composition root, health route, shared kernel (errors, Result, Pagination, Brand, logger, Supabase client factory).
- Tooling: pnpm, ESLint, Prettier, Vitest, Husky, GitHub Actions CI, Docker, Vercel entry.
- Docs: `docs/architecture.md`, ADR-0001 (logical CQRS), ADR-0005 (soft delete).
- Cursor rules: architecture, code-quality, error-handling, testing, database, git-conventions.
- Deferred: feature modules, schema/migrations, integration tests, production deploy.
