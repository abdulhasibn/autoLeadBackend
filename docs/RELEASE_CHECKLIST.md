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

## Done

_Nothing yet._
