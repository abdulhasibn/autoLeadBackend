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

1. Apply through the migration tooling (Supabase MCP `apply_migration` or `supabase db push`), **not**
   the SQL editor. Only the tooling records the migration in `supabase_migrations.schema_migrations`;
   SQL-editor runs leave no record, and nobody can tell later whether a migration was applied.
2. Apply to dev, test, then apply the **same file unchanged** to prod.
3. Add a row to **Pending on prod** when you apply to dev, then move it to **History** once prod has it.
4. Hosted versions get a fresh timestamp when applied with `apply_migration`, so they won't match the
   file name. Match migrations by **name**, not version.
5. To check status: `list_migrations` on both projects, then diff the names.

## Pending on prod

Checked 2026-11-11 against both projects' migration history and live schema.

| # | Repo file | Dev | Prod | What it does | Notes for prod |
|---|---|---|---|---|---|
| 1 | `20261110120000_commission_sales.sql` | ✅ recorded as `commission_sales` | ❌ | Two sale models only (ADR-0017): moves `intermediary_sale` cars to `consignment` and narrows `vehicles_acquisition_type_check` to `dealership_purchase` / `consignment` | Prod had 0 vehicles on 2026-11-11, so the data update is a no-op. Deploy the backend/frontend that stop sending `intermediary_sale` at the same time. |
| 2 | `20261110130000_default_na_variant.sql` | ⚠️ applied (21 `NA` variants + `add_default_variant()` trigger exist) but **not recorded** in the migration history | ❌ | Adds an `NA` variant to every model with no variants, plus a trigger that does this for new models | Apply to prod with `apply_migration` named `default_na_variant`. Safe to re-run (`on conflict do nothing`, `create or replace`, `drop trigger if exists`). Also re-apply to dev with the tooling so dev's history records it. |

Apply in this order: 1, then 2.

## History (applied to both)

Both projects share these 26 migrations, by name:

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
| 2026-11-11 | dev | Flushed all transactional data: vehicles, owners, contacts, leads, follow-ups, status/price history, vehicle financials, finance entries, audit logs, vehicle media rows + files in the `vehicle-media` bucket. Kept users, user_roles, roles, showrooms, the makes/models/variants catalog, finance_vault, finance_tags, finance_sessions. | Clean slate for testing |
