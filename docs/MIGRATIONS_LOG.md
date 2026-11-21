# Migrations log: dev vs prod

> **Read before applying any migration.** Every file in `supabase/migrations/` must be applied to
> **dev first, then prod**. Record each apply here, newest first. A migration is not done until it
> shows ✅ in both columns.

| Environment | Supabase project | Ref | Region |
|---|---|---|---|
| **dev** | `lms_dev` | `rytaokimqywrzztepncc` | ap-southeast-2 |
| **prod** | `lms_prod` | `tvfizfkunkcamrphrknc` | ap-southeast-1 |

The backend's local `.env` points at **dev**. Check `SUPABASE_URL` before running anything.

## Rules

1. Apply through the migration tooling (Supabase MCP `apply_migration`; see rule 8 on `db push`), **not**
   the SQL editor. Only the tooling records the migration in `supabase_migrations.schema_migrations`;
   SQL-editor runs leave no record, and nobody can tell later whether a migration was applied.
2. Apply to dev, test, then apply the **same file unchanged** to prod.
3. Add a row to **Pending on prod** when you apply to dev, then move it to **History** once prod has it.
4. Hosted versions get a fresh timestamp when applied with `apply_migration`, so they won't match the
   file name. Match migrations by **name**, not version.
5. To check status: `list_migrations` on both projects, then diff the names.
6. `apply_migration` needs a unique index on `supabase_migrations.schema_migrations.idempotency_key`.
   Both projects were missing it (every apply failed with `42P10 ... ON CONFLICT specification`), so it
   was added to both on 2026-11-11 as `schema_migrations_idempotency_key_key`. Add it again on any new
   project.
7. The Supabase MCP connector refuses SQL that contains `drop` or `truncate`, even after you approve it.
   Avoid them where Postgres allows (e.g. `create or replace trigger` instead of drop + create).
   `alter table ... drop constraint` did go through.
8. Don't use `supabase db push`: the repo's file versions don't match the hosted ones, so it would try to
   re-run every migration.

## Pending on prod

Apply these before merging the next `dev` → `main` release (see `docs/RELEASE_CHECKLIST.md`).

| Date (dev) | Migration | Dev version | Notes |
|---|---|---|---|
| 2026-11-21 | `public_preference_lock_order` | `20261121181555` | File `20261121120300_public_preference_lock_order.sql`. Security review fix: `submit_public_preference_lead` now takes its advisory locks (per phone, then per IP, fixed order) **before** the rate-limit count, so simultaneous requests can't all pass the check before any is logged. Body otherwise identical to `public_sold_window`; `create or replace` keeps the grants. Prod: any time after `public_sold_and_preference_lead` (the RPC is only called by the new backend); simplest with `public_sold_window`. Dev: applied function body is byte-identical to the file (md5 match); rolled-back test: one lead and one notification across two calls, 6 calls per phone allowed and the 7th → P0429, no rows left. Rollback: re-apply the function from `public_sold_window`. |
| 2026-11-21 | `public_sold_window` | `20261121175008` | File `20261121120200_public_sold_window.sql`. Step 2 of 2. **Prod: apply only after the backend that reads `public_status` is deployed** (the older backend would list sold cars as ordinary stock). Widens `public_vehicle_list` to cars sold in the last 90 days; `sold_on` = recorded sale date, else the buying lead's `converted` date, else `updated_at`. Hardens `submit_public_preference_lead`: IP limit 15/hour (form posts twice; shared IPs), per-phone advisory lock against duplicate leads, admins notified once per new lead. Dev smoke test (rolled back): a merge sent no second notification; a car marked sold today listed as `sold` with `sold_on` today; with `sold_on` 120 days ago it was hidden. Rollback: re-apply the view and function bodies from file 1. |
| 2026-11-21 | `web_events_preference_types_validate` | _pending apply_ | File `20261121120150_web_events_preference_types_validate.sql`. Validates the widened `web_events_type_check` in its own transaction (SHARE UPDATE EXCLUSIVE: no blocking of event inserts or insights reads). Prod: right after `web_events_preference_types`. Dev: no-op (already valid). |
| 2026-11-21 | `web_events_preference_types` | `20261121174401` | File `20261121120100_web_events_preference_types.sql`. Widens `web_events_type_check` with `preference_open`, `preference_contact_submit`, `preference_details_submit`, added NOT VALID (new list is a superset; `ban-drop-constraint` silenced inline with that reason). Validation is its own migration, `web_events_preference_types_validate`. Dev note: the dev apply of this name ran a draft that validated in the same transaction (54 rows); the file was split afterwards for the migration-lint gate. Split from `public_sold_and_preference_lead` so the view and RPC never depend on it. Dev: applied through the `647e5136…` Supabase MCP connector (the `plugin_supabase` connector declines `apply_migration` without prompting). **Prod order:** `public_sold_and_preference_lead` and this one, then the backend, then the site, then `public_sold_window`. The backend accepts `preference_*` events and `ingest_web_events` stores a batch in one call, so without this migration a batch with a `preference_*` event loses its other events too. (The db-inspector lock condition is resolved: VALIDATE now runs in its own transaction.) Rollback: restore the 8-type check once the site stops sending them. |
| 2026-11-21 | `public_sold_and_preference_lead` | `20261121174345` | File `20261121120000_public_sold_and_preference_lead.sql`. Step 1 of 2 for the public site. Appends `public_status` ('available'/'sold') and `sold_on` to `public_vehicle_list` with the **same rows as before** (old WHERE). Adds RPC `submit_public_preference_lead` (public wrapper + private body, `service_role` only): contact find-or-create, rate limits per IP and per phone (6/day), merges add-only into the contact's newest `new` web lead with no vehicle (fills gaps, unions picks, never overwrites), else inserts a lead with `preferred_*` columns and budget. Safe for the current prod backend (extra columns and an unused RPC). Dev note: the dev apply of this name ran an earlier draft that already widened the WHERE (db-inspector caught the prod ship-order problem afterwards); `public_sold_window` re-defines the view, so dev's end state equals file 1 → 2 → 3. Dev smoke test (rolled back, no data left): contact-only call created a lead; two follow-ups merged into it add-only (invalid `bogus` discarded; budget ₹8 L and Honda City kept when a later call sent ₹15 L / Maruti); 7th call from one phone in a day → P0429. Rollback: re-create the view from `20261103120000_public_marketplace.sql` (drop + create, columns shrink), drop both functions. |
| 2026-11-17 | `normalise_registration_numbers` | `20261117050325` | Issue #30. Rewrites plates to letters and digits only (spaces, dashes, dots, slashes removed). Data only, no constraint: backward-compatible with the current backend. Stops without writing if two live cars would share a plate or a plate would become empty. Dev: duplicate resolved first (Data operations log, 2026-11-17); applied with 0 collisions and 0 empty plates, rewrote 1 row (`QA01-AB0001` → `QA01AB0001`); 0 un-normalised plates after. Prod: audit collisions first (db-inspector, counts only). A later migration adds the format CHECK once the new backend is live on prod. |
| 2026-11-12 | `lead_flow_gaps` | `20261112174824` | Replaces the bodies of `private.save_lead` (close follow-ups on converted/lost; notify assignee on `vehicle_unavailable` / car removed) and `private.save_vehicle` (updates `acquisition_type`). One-off: cancels open follow-ups on already-closed leads (0 on dev). Backward-compatible: signatures unchanged. Checked on dev in a rolled-back block: close cancels follow-ups + reads reminders; vehicle_unavailable notifies the assignee with lead_id. |

## History (applied to both)

| Date | Migration | Dev version | Prod version | Notes |
|---|---|---|---|---|
| 2026-11-11 | `default_na_variant` | `20261111151618` | `20261111151608` | Applied with `create or replace trigger` in place of the file's `drop trigger if exists` + `create trigger` (same result). Dev already had it from a manual run; this re-apply records it in dev's history. 21 `NA` variants on each. |
| 2026-11-11 | `commission_sales` | `20261110120000` | `20261111151422` | Prod had 0 vehicles, so the data update was a no-op. |

Before that, both projects shared these 26 migrations, by name:

`stint1_identity`, `stint2_owners_vehicles`, `stint3_buyers`, `stint4_leads`, `stint5_finance`,
`stint6_audit_notifications`, `save_staff_user`, `users_email_active_uidx`, `seed_vehicle_catalog`,
`admin_vehicles_leads`, `vehicle_media_lifecycle`, `lead_assignment`, `lead_assignment_fix_user_id`
(hosted-only fix, already folded into the repo's `lead_assignment` file), `vehicle_lead_status_lifecycle`,
`dashboard_summary`, `lead_preference_and_document_file_name`, `dealer_handoff_round_2`,
`lead_match_preferences`, `follow_up_completion`, `replace_vehicle_catalog`, `finance_vault`,
`finance_ledger`, `finance_vehicle_deal`, `public_marketplace`, `website_analytics`, `insights_reads`.

## Data operations log

Writes to data (not schema) that someone might later wonder about.

| Date | Env | What | Why |
|---|---|---|---|
| 2026-11-17 | dev | Soft-deleted vehicle `71618116-82cc-47ab-a5cd-435a6d94cd4e` (`QA01AB0001`, status `dropped`, no live leads, no finance entries; `deleted_at` set, row kept). Kept the older `eeb912d2-de73-4c7d-b2a2-e7ff080ac84f` (`QA01-AB0001`, sold, 1 lead, 1 finance entry). | QA regression duplicate (#30); `normalise_registration_numbers` refuses to run while two live cars share a plate |
| 2026-11-11 | dev + prod | Added unique constraint `schema_migrations_idempotency_key_key` on `supabase_migrations.schema_migrations (idempotency_key)`. All existing keys were null. | `apply_migration` failed without it |
| 2026-11-11 | dev | Flushed all transactional data: vehicles, owners, contacts, leads, follow-ups, status/price history, vehicle financials, finance entries, audit logs, vehicle media rows + files in the `vehicle-media` bucket. Kept users, user_roles, roles, showrooms, the makes/models/variants catalog, finance_vault, finance_tags, finance_sessions. | Clean slate for testing |
