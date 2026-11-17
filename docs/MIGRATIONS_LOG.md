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
