# Release checklist: `dev` → `main`

> **Read this before opening or merging a release PR (`dev` → `main`).** Every
> item under **Next release** must be done (and ticked here, in the same PR) before
> the release PR is merged. When a release ships, move its items to **Done** with
> the date.

Merging into `main` deploys the backend to prod. Prod database changes go
**before** the merge, so the new code finds the schema it expects. Every migration
here is backward-compatible, so applying it early is safe for the code still on prod.

## Every release

- [ ] `docs/MIGRATIONS_LOG.md` → **Pending on prod**: apply each listed migration to
      **prod** (`lms_prod`, `tvfizfkunkcamrphrknc`) with Supabase MCP `apply_migration`,
      using the same file unchanged. Then move its row to **History** with the prod version.
      Prod writes need the user's explicit go-ahead.
- [ ] `list_migrations` on dev and prod: same names on both.
- [ ] Postman collection synced for any endpoint added since the last release
      (`/sync-postman`).
- [ ] Deploy the backend before the frontend when the frontend depends on new API fields.

## Next release

Added 2026-11-12, from abdulhasibn/autoLeadBackend#19 and abdulhasibn/autolead-frontend#15.

- [ ] **Apply `lead_flow_gaps` to prod** (`supabase/migrations/20261112120000_lead_flow_gaps.sql`).
      Already on dev (`20261112174824`). Until it's on prod:
  - closing a lead doesn't cancel its follow-ups;
  - assignees get no "car no longer available" / "car removed" notifications;
  - changing purchase vs commission on a car isn't saved.

  After applying, check on prod that no open follow-ups are left on converted or lost leads:

  ```sql
  select count(*) from public.follow_ups f join public.leads l on l.id = f.lead_id
   where l.status in ('converted', 'lost') and f.completed_at is null and f.deleted_at is null;
  ```

- [ ] **Sync Postman** for the new `POST /leads/:id/reopen` (undo a sale) and the new
      `leadId` / `bookedLeads` fields on finance car money (from #17).

Added 2026-11-24, from abdulhasibn/autoLeadBackend#74 and abdulhasibn/autolead-frontend#103
(new lead status `in_progress`).

- [ ] **Check prod's migration history has its idempotency-key constraint** before applying
      anything. Dev lost `schema_migrations_idempotency_key_key` in the 2026-11-22 restore and
      `apply_migration` failed until it was re-added (Data operations log, 2026-11-24).
      db-inspector, read-only:

  ```sql
  select count(*) from pg_constraint
   where conrelid = 'supabase_migrations.schema_migrations'::regclass
     and conname = 'schema_migrations_idempotency_key_key';
  ```

  `1` means fine. `0` means re-add it on prod (user's go-ahead) before the migrations below.

- [ ] **Apply the three `lead_status_in_progress*` migrations to prod, in order, before the
      backend merge:** `20261124120000_lead_status_in_progress`,
      `20261124120100_lead_status_in_progress_validate`,
      `20261124120200_lead_status_in_progress_functions`. Already on dev (`20261124010957`,
      `20261124011008`, `20261124011100`). All backward-compatible. If the backend ships first,
      completing a follow-up as "Reached" on a New lead returns an error after the follow-up is
      saved (the status rule rejects `in_progress`).

  After applying, check on prod that the rule is valid and the dashboard has the new count:

  ```sql
  select convalidated from pg_constraint where conname = 'leads_status_check';
  select private.dashboard_summary(null, null, now() - interval '30 days', now(),
    now() - interval '60 days', now() - interval '30 days', now() + interval '1 day',
    now() - interval '45 days', 1) -> 'pipeline' ? 'in_progress';
  ```

- [ ] **Deploy order:** prod migrations → backend → CRM. The CRM shows In progress as 0 on an
      older backend, but its status menu would offer a status the old backend rejects.

## Done

_Nothing yet._
