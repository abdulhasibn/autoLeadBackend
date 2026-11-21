# DB pre-check: feat/site-sold-and-preference-lead

Pre-check, not a release review. Static review plus code grep. **No production queries were run:**
`PROD_DB_READONLY_URL` is not set in this environment, so steps 1 (prod history/drift) and 4 (data
compatibility) are unverified and listed below as open queries. Dev was not queried either (only
migration files, `origin/main` and `origin/dev` code were read). No dry run.

Migrations (dev versions `20261121174345`, `20261121174401`):
- `supabase/migrations/20261121120000_public_sold_and_preference_lead.sql`
- `supabase/migrations/20261121120100_web_events_preference_types.sql`

## Verdict: BLOCK (as currently sequenced)

| # | Severity | Where | Evidence | Fix |
|---|---|---|---|---|
| 1 | feature_break (BLOCK) | `..120000...sql:40-62` (view WHERE) | `origin/main` (prod backend, last commit 2026-11-11) reads `public_vehicle_list` in `list`, `get`, `listAll` with a fixed column list and **no `public_status` filter** (`grep -c public_status` on main = 0). The migration widens the WHERE to sold cars, so the moment it lands the live backend serves sold cars (last 90 days) as ordinary available listings: in the showroom list and counts, on the detail page, in filter options and the sitemap. Nothing marks them sold. The log's ship order ("migration before the backend") is the wrong way round for this change; the reverse order fails too (new backend selects `public_status, sold_on`, which do not exist on prod: 42703). | Expand/contract across two releases. Release A (before the backend): replace the view with the two columns appended but the **old WHERE** (`public_status` always 'available'). Deploy backend. Release B: second migration widens the WHERE. Or add a new view for the new backend and leave `public_vehicle_list` untouched. Alternatively deploy migration and backend in one window and accept sold cars appearing for the gap; I would not. |
| 2 | long_lock (BLOCK until measured) | `..120100...sql:10-18` | Squawk `constraint-missing-not-valid`: `drop constraint`, `add ... not valid` and `validate` run in one file, which both the CLI and the MCP connector execute as one transaction. The ACCESS EXCLUSIVE lock taken by the DROP/ADD is held to commit, so VALIDATE is a full scan **under ACCESS EXCLUSIVE**: all reads and writes on `web_events` (the live site's `ingest_web_events` plus the CRM insights reads) wait for the scan. NOT VALID buys nothing here. Row count unknown (see queries). `lock_timeout` is set; `statement_timeout` is not (squawk `require-statement-timeout`). Additionally, ingest is unguarded between nothing: the swap is atomic, so no unchecked window exists. | Split into two migrations: (1) `drop` + `add ... not valid` (instant); (2) `validate constraint` alone (SHARE UPDATE EXCLUSIVE, writes continue). Or, since the new list is a strict superset of the old, add the new check NOT VALID first, then validate, then drop the old one. Add `set statement_timeout`. If the prod row count is under roughly 100k the scan is sub-second and this drops to a condition rather than a block. |
| 3 | low | `..120000...sql:55-61` | `sold_on` falls back to `vehicles.updated_at::date` when `vehicle_financials.sold_on` is null. Any later edit of a sold car (price, notes, a status-history touch) bumps `updated_at`, so it re-enters the 90-day window and re-appears as "sold today". | Prefer a real sold date (`sold_on` required when status = sold), or drop the fallback and count only rows with `sold_on`. Open query Q5 shows how many sold cars lack `sold_on`. |
| 4 | info | squawk | View/RPC file: 0 findings. CHECK file: 3 warnings (statement_timeout, drop constraint, not valid + validate in one txn). `.squawk.toml` present. | See #2. |

## Checks you asked for

**Lock and dependency safety.**
- View replace: `create or replace view` takes a brief ACCESS EXCLUSIVE on the view only, no table rewrite; `lock_timeout` 5s/`statement_timeout` 60s set. Only appends two columns at the end (valid for replace; the existing column order and types are unchanged). Dependents of the view: none in migrations (only `vehicle_media` embedding is inferred by PostgREST from `v.id`, unchanged). Confirm on prod with Q6. Fine apart from #1 (behavior, not locks).
- CHECK swap: see #2. Superset of the old list (8 old types plus 3 new), so no row can fail validation: Q2 confirms.

**Grants / leak.** Static: view keeps `security_invoker = true`, `revoke all ... from anon, authenticated`, `grant select ... to service_role` (re-stated in the migration; replace preserves them anyway). Both RPC functions: `revoke all from public, anon, authenticated`, `grant execute to service_role` on both `private.` and `public.` (the wrapper is `security invoker`, so it only works for service_role; the private function also needs table access, which service_role has through the backend). Nothing is exposed to anon/authenticated. Sold cars expose the same columns as available ones plus `sold_on`; `sold_lead_id`, registration, owner and sale price are not exposed. `listed_price` of a sold car is the asking price, not the deal price. The new information is only "this car sold on date X" and the car's identity for 90 days; that is the intended feature. Confirm on prod with Q7 (view grants, reloptions).

**Deployed prod backend after the migration.** Breaks, see #1. The RPC and `preference_*` events are additive: the current backend ignores them. Until the CHECK is widened, the site's `preference_*` events are rejected on insert (the form itself still works), as the log says. `submit_public_test_drive` already handles a sold car via `v_listed`, so test-drive intake for a sold car is not a new problem.

**Prod schema has what the RPC references (static, from the migration chain; confirm with Q1/Q3).** All are created by migrations the log lists as applied to both projects:
- `vehicle_financials.sold_on date`: `20261102140000_finance_vehicle_deal` (`finance_vehicle_deal` in History).
- `leads.preferred_make_id/model_id/variant_id` and `leads_preferred_catalog_chain_check`: `20261006120000`; `preferred_fuel_types`, `preferred_transmissions`, `preferred_body_types` (`text[] not null default '{}'`) and their `<@` CHECKs, whose allowed lists match the RPC's whitelists exactly: `20261010120000_lead_match_preferences`.
- `leads.budget numeric(12,2)`: `20260902120300_stint4_leads`. `leads.preferred_vehicle` (text) from the same chain.
- `public_request_log(kind, key, created_at)`: `20261103120000_public_marketplace`. The RPC adds two new kinds with no constraint on kind (no CHECK on it in that file).
- `notifications(user_id, type, title, body, entity_type, entity_id)`: `20260902120500`; type 'website_lead' already used.
- `lead_attribution` columns (all 19 inserted names): `20261104120000_website_analytics`; the channel CHECK covers the values the RPC can send only if the site sends valid channels (same as the test-drive RPC).
- The catalog-chain CHECK is respected: model is set only when the make matched, and an existing make is never overwritten without its model logic.
Residual risk: the RPC body is `plpgsql`, so a missing column on prod would fail only at first call, not at migration time. Q1/Q3 (information_schema) settle this; they were not run.

**Rollback.**
- RPC: `drop function public.submit_public_preference_lead(...)`, then the private one (signatures in the file). Safe: nothing else depends on them once the site stops calling them. Leads created by the RPC stay (valid ordinary leads).
- View: cannot be rolled back with `create or replace` (columns would shrink); needs drop + create from `20261103120000_public_marketplace.sql`, which needs ACCESS EXCLUSIVE and fails with the new backend still selecting `public_status` (so deploy the old backend first). The log's rollback note is correct but untested. A two-release split (#1) makes the view step trivially reversible (re-replace with the old WHERE, no column change).
- CHECK: re-adding the 8-type check fails validation once any `preference_*` row exists; delete or migrate those rows first. Untested.
- Neither migration has a down file; rollback is manual.

## Feature impact map

| Object | `main` (prod) | PR branch | Features |
|---|---|---|---|
| `public_vehicle_list` | `supabase-public-vehicle.queries.ts` (`list`, `get`, `listAll`); `database.types.ts` | same, plus `public_status`/`sold_on`, filter `eq('public_status','available')` in `listAll` | Showroom list, car detail, filter options, sitemap (wheelsExpertsWeb via the API) |
| `submit_public_preference_lead` | none | new RPC adapter | Website preference form |
| `web_events_type_check` | `ingest_web_events` / `web-event-ingest.port.ts` | adds `preference_*` types | Site analytics, CRM insights (`20261108120000_insights_reads`) |
| `leads`, `contacts`, `lead_attribution`, `lead_status_history`, `notifications`, `public_request_log` | existing writers (`save_lead`, `submit_public_test_drive`) | RPC inserts/updates | CRM lead list, website-lead notifications, attribution reports |

`wheelsExpertsWeb/src` and `autoLeadFrontend/src` were not grepped in this pre-check; they reach the view only through the API.

## Open queries for the production session (aggregate only; need user approval and `PROD_DB_READONLY_URL`)

None run. Results: not available.
- Q1: `select table_name, column_name, data_type from information_schema.columns where (table_name, column_name) in (('vehicle_financials','sold_on'),('leads','budget'),('leads','preferred_make_id'),('leads','preferred_model_id'),('leads','preferred_body_types'),('leads','preferred_fuel_types'),('leads','preferred_transmissions'),('leads','preferred_vehicle'),('public_request_log','kind'),('notifications','entity_id'),('lead_attribution','last_landing_path'));` expect 11 rows.
- Q2: `select count(*) total, count(*) filter (where type not in ('page_view','car_view','gallery_open','filter_apply','test_drive_open','whatsapp_click','call_click','directions_click','preference_open','preference_contact_submit','preference_details_submit')) outside_new_list from public.web_events;` expect outside_new_list = 0; total sizes the VALIDATE scan.
- Q3: `select conname from pg_constraint where conrelid='public.leads'::regclass and conname like 'leads_preferred_%';` expect the catalog chain plus 7 list/range checks.
- Q4: `select pg_size_pretty(pg_total_relation_size('public.web_events'));` and `select count(*) from public.web_events where occurred_at > now() - interval '1 hour';` (write rate).
- Q5: `select count(*) filter (where v.status='sold' and f.sold_on is null) sold_no_date, count(*) filter (where v.status='sold' and coalesce(f.sold_on, v.updated_at::date) >= current_date-90) sold_in_window from public.vehicles v left join public.vehicle_financials f on f.vehicle_id=v.id where v.deleted_at is null;` shows how many cars would appear instantly (#1) and how many rely on the fallback (#3).
- Q6: `select dependent.relname from pg_depend d join pg_rewrite r on r.oid=d.objid join pg_class dependent on dependent.oid=r.ev_class where d.refobjid='public.public_vehicle_list'::regclass and dependent.oid <> d.refobjid;` expect 0 rows.
- Q7: `select grantee, privilege_type from information_schema.role_table_grants where table_name='public_vehicle_list';` expect only service_role (plus owner).
- Also: `supabase migration list` / `db diff --linked` for history and drift (not run).

## Apply order (after fixes)

1. Prod: view-columns-only migration (old WHERE), RPC, CHECK in two statements/two transactions.
2. Deploy backend (uses `public_status`, RPC).
3. Prod: WHERE-widening migration. Then deploy the site build that shows sold cars.
Today's single-step order (migration, then backend) breaks the live site per #1.

## Handoff

Needs from dba: split/re-sequence both migrations (#1, #2). Needs from user: `PROD_DB_READONLY_URL` plus the SQL role if absent, and approval for Q1-Q7. Re-run this check on the revised migrations.
