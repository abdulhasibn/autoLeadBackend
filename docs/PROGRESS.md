# Project Progress Log

> **Agents:** Read the **Current stage** section first. Append a new log entry when you complete a meaningful chunk of work (schema, feature, infra). Keep entries newest-first under the log. Do not rewrite history — only amend **Current stage** / **Next up**.

## Current stage

**Stage:** **Staff vehicle + lead phase** — admin and salesperson intake, linked vehicle/lead status lifecycle (ADR-0011), walk-in leads with assignment, staff inbox.

| Area | Status |
|------|--------|
| Repo scaffold (Express / TS / Vitest / CI) | Done |
| Architecture docs + ADR-0001 / ADR-0005 / ADR-0006–0015 | Done |
| Cursor rules (architecture, quality, errors, testing, database, git) | Done |
| Supabase project | Done (`autolead`, `ap-south-1`) |
| SQL migrations (stints 1–6 + save_staff_user + email unique + catalog seed + admin vehicles/leads + media lifecycle + lead assignment + status lifecycle + dashboard summary + lead preference / document file name + dealer handoff round 2 + lead match preferences + follow-up completion + replace vehicle catalog + finance vault + finance ledger + finance vehicle deal + public marketplace) | All 23 applied to hosted project (plus hosted-only `lead_assignment_fix_user_id`, already folded into the repo file) |
| Schema source of truth (`docs/schema.dbml`) | Done |
| Generated `database.types.ts` | Done |
| Local `.env` with service role key | Done — local dev only, not committed |
| Auth feature (`src/features/auth`) | Done — email + password login/refresh, bearer, /auth/me (roles + home `showroomId`); roles from `user_roles`; logout (local / global), change password, forgot / reset password with a 6-digit email code (code done; Gmail SMTP + recovery template on hosted still to apply via `pnpm auth:configure-email`) |
| Showrooms (`src/features/showrooms`) | Read-only `GET /showrooms` directory for staff pickers |
| Users / roles (`src/features/users`) | Done — staff CRUD + email/password provision (Admin) |
| Owners (`src/features/owners`) | Done — staff owner CRUD (Admin / Salesperson; deactivate Admin-only); list `search` |
| Vehicles (`src/features/vehicles`) | Staff create/list/get/update, catalog reads, signed media/document uploads (list/get carry a signed `frontImageUrl`; documents keep `fileName`; status history names the actor; list/get carry `linkedLeadCount`; list `search` + catalog / year / km / fuel / transmission filters via the `vehicle_list` view); statuses `open` / `linked` / `dropped` / `sold` (Admin drops/re-lists; `linked`/`sold` follow leads) and deletes |
| Inventory (`src/features/inventory`) | Not started |
| Marketplace (`src/features/marketplace`) | Anonymous browse, detail, filters and test-drive requests (`/public`, ADR-0010) |
| Leads (`src/features/leads`) | Staff walk-in create, associate vehicle (`linkedVehicle` summary on reads), structured preference (catalog make → model → variant plus colours / fuel / transmission / body type / year window / km ceiling / max owners; budget = price ceiling; set on create or `PUT /leads/:id/preference`), `GET /leads/vehicle-matches/:vehicleId` (weighted match % for linked leads + suggested open leads, ADR-0013) and the reverse `GET /leads/:id/vehicle-matches` (linked car + suggested linkable cars for one lead), status (`new` / `not_now` / `booking_confirmed` / `converted` / `lost` / `vehicle_unavailable`; converting sells the vehicle), follow-up + due notification, `GET /leads/:id/follow-ups` (open / closed / all), complete (outcome + notes, optional next follow-up in the same transaction) and cancel; Admin assignment; salesperson sees assigned leads only; `PATCH /leads/:id` edit, `DELETE /leads/:id/vehicle` unlink, `GET /leads/:id/status-history`, `assignedToName`, list `search` + budget / source / link / timeline / finance / created-at filters |
| Sales (`src/features/sales`) | Not started |
| Dashboard (`src/features/dashboard`) | `GET /dashboard` — KPIs, attention lists, today's follow-ups (ADR-0012); admin `scope: all`, salesperson `scope: mine` (own leads, no stock); money tiles via `GET /finance/summary` (needs the finance session) |
| Finance (`src/features/finance`) | Done (phases 1–5) — reports: profit & loss and cash flow by day / week / month / year, profit per car, dues, stock, dashboard summary. Car money (ADR-0015): purchase rate, sale (finalised price + date), quotes, landing cost, profit, dues to seller / from buyer, per-car summaries, sold-without-price list. Encrypted ledger: income/expense entries with configurable tags (defaults seeded on first unlock), optional car link from either side, purpose (`purchase`/`cost`/`sale`/`other`/`general`), list with in-memory filters + totals. Encrypted vault (ADR-0014): setup with finance + recovery keys, recovery-key confirmation, unlock sessions (`X-Finance-Session`, 30 min idle / 8 h), lock, change key, recover, 5-failure lockout, value-free audit, log redaction. Seeder fills encrypted finance data; smoke script checks finance read-only |
| Notifications (`src/features/notifications`) | Staff inbox (`due_at` filter, `isRead` filter, `unreadCount`) + mark read; `follow_up_due`, `lead_assigned`; items carry `leadId` |
| Audit trail (cross-cutting) | Partial — status history tables; lead assignment and finance vault actions in `audit_logs` |
| Postman collection (Health, Auth, Users, Owners, Catalog, Vehicles, Leads, Notifications, Dashboard, Showrooms, Finance › Vault / Tags / Entries / Car money) | Done — local `postman/`, GitHub repo, cloud My Workspace |
| Frontend API guide (`docs/api.md`) | Done — current endpoints + how to start |
| HTTP integration tests (local Docker Supabase) | Not started |
| Vercel production host | Done — `autolead-backend` (`bom1`), `https://autolead-backend-lyart.vercel.app` |

**Supabase project**

| Field | Value |
|-------|-------|
| Name | `autolead` |
| Ref | `pptljtbxqzmjossuamve` |
| Region | `ap-south-1` (Mumbai) |
| URL | `https://pptljtbxqzmjossuamve.supabase.co` |
| Dashboard | [Project settings](https://supabase.com/dashboard/project/pptljtbxqzmjossuamve) |
| Tables | 29 |
| Migrations applied | 24 hosted rows (23 repo migrations + `lead_assignment_fix_user_id`) |
| Roles seeded | admin, salesperson, owner, buyer |

## Next up

1. Merge `feat/dealer-handoff-round-2` (its migration is already on hosted), deploy, then run `scripts/smoke-api.sh` with admin credentials and ask the dealer team to move handoff items 2–13 to Resolved.
2. Run the live `scripts/smoke-api.sh` flow against production (needs `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
3. Import the updated Postman collection into the cloud workspace (see 2026-11-08 log).
4. Inventory listing guard + pricing (Stint 3.1), then the public marketplace module (ADR-0010).

## Log

### 2026-11-08 — Insights read endpoints (website analytics, read side)

- New feature `src/features/insights/` (admin only; salespeople get 403): `GET /insights/traffic`, `/insights/vehicles`, `/insights/vehicles/:vehicleId`, `/insights/demand` (all `?period=today|week|month|quarter&showroomId=`) and `GET /insights/leads/:leadId`. Shapes are the web app's contract (`autoLeadFrontend/src/features/insights/types.ts` and its fixtures); documented in `docs/api.md`, Postman folder **Insights** with 200 / 403 / 404 examples.
- Periods reuse the dashboard's rules, moved to `src/domain/shared/reporting-period.ts` (`dashboard-window.ts` re-exports them unchanged): business timezone, period to date, previous = same elapsed span.
- Migration `20261108120000_insights_reads.sql` (applied to hosted 2026-11-08 via Supabase MCP as `insights_reads`; checked read-only: functions run, only `service_role` can execute them): read-only `insights_traffic`, `insights_vehicle_stats`, `insights_vehicle_detail`, `insights_demand`, `insights_lead_journey` (private + public wrapper, service_role only) and one index `web_sessions (visitor_id, started_at)`. No table or column changes. Raw counts only; rates, signals, bands and labels live in the use cases.
- Approximations: traffic `leads` counts attributed website leads only (visitors who block beacons have no channel); vehicle `leads` counts every lead on the car, any source; segments are catalog body types (`SUV`, not the fixture's `Compact SUV` / `Premium SUV` split, which has no data source); demand comes from `filter_apply` props (`priceMax`, `bodyType`, `resultCount`).
- Verified: unit, use-case and route tests (shapes, periods, 401/403/422/404); every migration replayed on local Postgres 17 and the five functions run against seeded rows. Hosted has 0 web sessions/events so far, so every endpoint returns zero counts until the site sends traffic.

### 2026-11-08 — Dealer app handoff: finance fixes and two list filters

- **Fix (finance reports):** a sold car without a purchase rate counted its whole finalised price as sales with ₹0 cost of sales, inflating P&L, the summary and the dashboard tiles. It now stays out of sales, cost of sales and profit (and its later costs too), is counted in `carsMissingPurchaseRate`, and its price is reported as `uncountedSales`. Profit-per-car totals follow the same rule. Raised by the dealer app team in `wheels-expert-dealer/docs/BACKEND_HANDOFF.md`.
- Quotes: `leadId` is required and must be a live lead; quote reads carry `lead: { id, name, phone }` via a finance-local lead lookup (contact or registered buyer), batched per request.
- `GET /vehicles`: `priceMin` / `priceMax` on `listedPrice`. `GET /leads`: `linkedMakeId` / `linkedModelId` / `linkedVariantId` (inner join on the linked car's catalog).
- Verified: unit and use-case tests; filters checked read-only against hosted (counts match SQL). The live finance vault was not touched.

### 2026-11-08 — Finance phase 5: encrypted seed data, smoke checks

- `pnpm seed:test-data` now also seeds finance through the API's own code (`scripts/lib/seed-finance.ts`: `NodeFinanceCrypto`, domain entities, sealers, mappers): an active vault, 15 tags, ~1,500 entries (seller payments, costs, buyer payments, business running costs), deals for every live car, quotes, sales with some balances still due, a few sold cars awaiting a price, two deleted mistakes, and one car holding the client's worked example exactly. Every sealed row is reopened and the client car must come to landing ₹5,45,000 / profit ₹15,000, or the script stops. `SEED_FINANCE_KEY` fixes the finance key; otherwise it is generated; both keys are printed at the end (test-only). Finance has its own random stream, so the rest of the seed data is unchanged. `--dry-run` now skips the empty-database check (it writes nothing), so it can be run against a full database.
- `scripts/smoke-api.sh`: the 30 finance routes join the 401 checks; with `FINANCE_KEY` it runs read-only finance checks (vault, lock/unlock, tags, entries, car money lists, every report, summary, 423/422 cases); `FINANCE_ONLY=1` skips the staff flow (which writes test records) so production can be checked safely.
- **Fix:** the smoke script's live flow failed at admin login on macOS: bash 3.2 brace-expanded the JSON bodies built inside `"$(call …)"`, splitting them at commas (`400 INVALID_JSON`). `set +B` fixes it; bash 5 was never affected.
- Verified: dry run (self-check passes, client car `KA30DH3851` in that run), token-free and `FINANCE_ONLY` smoke runs pass (80/80). The live finance smoke checks were not run: hosted now has a real vault set up on 2026-11-05 and was left untouched; run `FINANCE_ONLY=1 FINANCE_KEY=… scripts/smoke-api.sh` with its key.
- Postman cloud not updated by script (the full collection is too large to push through the connector reliably): import `postman/AutoLead-API.postman_collection.json` into My Workspace, replacing "AutoLead API".

### 2026-11-03 — Finance phase 4: reports and summary

- Reports computed after decryption in pure domain functions (no migration): profit & loss (a car counts on its sale date with its purchase rate and the costs up to that date; later costs, other income and business expenses on their own dates; payments to sellers / from buyers excluded), cash flow (every entry by date with splits and a running total), profit per car, dues, stock (dropped cars stay until dealt with) and a month-to-date summary against the same span of last month. Periods day / ISO week / month / year; empty buckets returned for charts; optional showroom filter.
- Tested: the client's car lands entirely in its sale month; over all time profit & loss equals car profits + other income − business expenses.
- Shared `src/domain/shared/business-calendar.ts` (moved from the dashboard window, behaviour unchanged) so finance doesn't import the dashboard. Long car-id lists are now fetched in batches of 100.

### 2026-11-02 — Finance phase 3: car deal, sale, quotes, profit and dues

- Migration `20261102140000_finance_vehicle_deal`: `vehicle_financials` drops the plaintext price and commission columns (seed data) and gains a sealed `payload` (purchase rate, owner-expected and minimum prices, finalised price, note) plus plaintext `sold_on`; `listed_price` and `sold_by` stay plaintext. New `vehicle_quotes` (sealed amount, person, note). Seeders write only `listed_price` now.
- `calculateVehicleMoney` (pure domain function, supersedes ADR-0009's acquisition-type switch): landing cost = purchase rate + cost entries; profit = finalised − landing; owed to seller / by buyer from purchase and sale payments; cost breakdown by first tag.
- Endpoints: car money tab, set deal (incl. plaintext listed price), record / clear sale, quotes (newest = current), summaries for up to 100 cars, sold cars awaiting a sale price. Recording a sale never changes car status.
- The client's worked example passes end to end: landing ₹5,45,000, profit ₹15,000, nothing owed.

### 2026-11-02 — Finance phase 2: tags and the income/expense ledger

- Migration `20261102130000_finance_ledger`: drops the plaintext `expenses` / `income` seed tables; adds `finance_entries` (plaintext kind / car / date / showroom for filtering, everything else in the sealed payload) and `finance_tags` (sealed name + colour, archived never deleted). The seeder no longer writes finance rows (encrypted seeding is phase 5).
- Entries: income or expense, amount, date, up to 10 tags, optional car link (car's showroom), purpose rules per ADR-0015, party, note; link / move / unlink resets purpose unless sent. Tags: unique names ignoring case, colour, archive / restore; archived tags stay on entries but can't be added. Default tags are created on first unlock (names are encrypted, so no SQL seed).
- `GET /finance/entries`: SQL narrows by date (required, ≤ 366 days, unless one car), kind, car / unlinked, showroom; tags, purpose, amount, search, sort and paging run after decryption; `totals` over the filtered set; `truncated` past 5,000 rows.
- The client's worked example is a test: one car's entries total income ₹5,60,000, expense ₹5,45,000, costs ₹45,000. Verified end to end against hosted (test vault deleted afterwards).
- **Fix (all routes):** a body that isn't valid JSON returned 500 and the error log carried the raw body (in `err.body` and `err.message`), which could leak finance keys or amounts. It now returns `400 INVALID_JSON` (`413 PAYLOAD_TOO_LARGE` for oversized bodies) and logs only path and method.

### 2026-11-02 — Finance phase 1: encrypted vault

- ADR-0014 (finance data encrypted with session-unlocked keys) and ADR-0015 (one ledger of tagged income/expense entries, single profit formula) accepted; ADR-0009 superseded in part. Plans: `docs/plans/finance-module.md`, `docs/plans/finance-phase-1-vault.md`.
- Migration `20261102120000_finance_vault` applied to hosted: `finance_vault` (singleton; data key wrapped by the finance key and by the recovery key; scrypt N=2¹⁷) and `finance_sessions` (data key wrapped by a key derived from a secret only the client holds). RLS on, no policies.
- `src/features/finance`: setup (keys shown once, vault pending) → confirm with the recovery key → unlock (`X-Finance-Session`, 30 min idle / 8 h) → lock; change key (re-wraps only, ends other sessions); recover (rotates both keys, ends all sessions). Five wrong keys in 15 minutes block key entry for 15 minutes. `FinanceSessionService.open` is the only way to get a `FinanceCipher` (AES-256-GCM, row-bound AAD, 256-byte padding) for later phases.
- Logger redacts the session header, keys, tokens and payloads; a test captures output to prove it. Audit rows name the action only.
- Verified end to end against hosted: every flow, lockout, 403 for salespeople; no keys or tokens in the DB or server logs. The test vault was deleted afterwards, so the admin runs setup themselves.

### 2026-10-17 — Architecture audit; operator scripts moved to TypeScript

- Audit of every `src/features/*` against `.cursor/rules/architecture.mdc` (H1–H12): no hard rejects. Every feature has all four layers; no cross-feature imports; Supabase only in infrastructure; no command use case takes a query port. One soft drift fixed: follow-up status (completion wins over cancellation) was re-derived in `supabase-follow-up.queries.ts`; now one domain function, `followUpStatusOf`, used by the entity and the read model.
- `scripts/*.mjs` → TypeScript, typed against `database.types.ts` (typing caught `source_id` being an integer, not a string, in the catalog import). Shared `scripts/lib/supabase.ts` (client, `check`, `run`) and `scripts/lib/random.ts` (seeded PRNG + sampling).
- New commands: `pnpm seed:test-data [--dry-run]`, `pnpm seed:demo-vehicles [--cleanup]`, `pnpm catalog:import <dir>`; `pnpm auth:configure-email` now runs the `.ts`. `pnpm typecheck` also checks `scripts/` (`tsconfig.scripts.json`), so CI covers them.
- Behaviour unchanged: both seeders were run old-vs-new against a stubbed Supabase with a frozen clock and UUIDs; recorded writes are byte-identical (the demo seeder needs file-read timing pinned too, since its parallel workers made even the old script non-deterministic).

### 2026-10-13 — Catalog replaced with master data; hosted DB wiped

- Hosted DB wiped: every `public` table except `roles` and `showrooms`, all `auth.users`, and the `vehicle-media` / `vehicle-documents` buckets.
- Re-seeded with `scripts/seed-test-data.mjs`: six months of simulated showroom activity (staff incl. a deactivated salesperson and an admin who also sells, owners, ~330 vehicles in every status with photos / documents / financials, ~720 leads across all sources and statuses incl. revived `vehicle_unavailable`, reassignments + audit log, follow-ups in every state and outcome, notifications, buyers with saved / viewed cars, expenses and income). Direct inserts with backdated timestamps; the script keeps the ADR-0011 link / sale invariants itself. `--dry-run` prints the simulated distributions. Every seeded login uses `secret12` (admin: `admin@example.com`).
- Migration `20261013120000_replace_vehicle_catalog`: `source_id` (+ `logo_url`) on makes / models / variants, `body_type` / `segment_type` on models, `launch_year` / `discontinued_year` on variants, fuel `lpg` / `lpg_petrol` allowed; `(make_id, name)` and `(model_id, name)` no longer unique (the export repeats names across launch windows).
- `scripts/import-vehicle-catalog.mjs <export-dir>` loads brands / models / variants JSON (upsert on `source_id`): 67 makes, 725 models, 22,620 variants. Old spec columns (`ex_showroom_price`, dimensions, power…) are null for this data.

### 2026-10-10 — Sign out, change password, forgot / reset password

- **Bug fix:** both shared Supabase clients now set `autoRefreshToken: false` (and `detectSessionInUrl: false`). Before this, in Node, the anon auth client ran auth-js's background refresh ticker on the session from the most recent sign-in or refresh. It could rotate that user's refresh token server-side, so their next `/auth/refresh` failed. A regression test pins the options.
- Endpoints:
  - `POST /auth/logout` (bearer; `scope` `local` | `global`, `204`)
  - `POST /auth/change-password` (bearer; checks the current password, sets the new one, ends every other session, `204`)
  - `POST /auth/forgot-password` (public; always `202`, so accounts can't be probed)
  - `POST /auth/reset-password` (public; redeems the 6-digit recovery code, sets the password, ends every session, `204`)
- New codes: `422 INVALID_CURRENT_PASSWORD` (deliberately not 401), `PASSWORD_UNCHANGED`, `WEAK_PASSWORD`, `INVALID_RESET_CODE`, and `429 RATE_LIMITED`. A failed refresh now says "Invalid or expired refresh token".
- Design:
  - `IAuthProvider.signOut` uses the stateless `auth.admin.signOut(jwt, scope)`.
  - New `IPasswordCredentials` port, implemented by `SupabasePasswordCredentials` with the anon and service-role clients. The password check signs in and immediately revokes that throwaway session. Passwords are set by user id.
  - `ResetCode` VO.
  - The bearer middleware also exposes `req.accessToken` (`requireAccessToken`).
  - `composeAuth` now takes the logger.
- Ops: `scripts/configure-auth-email.mjs` (`pnpm auth:configure-email`, ported from gymBackend) PATCHes Supabase Auth config with:
  - Gmail SMTP
  - the recovery template showing `{{ .Token }}`
  - OTP length 6, 15-minute expiry
  - higher verify / token-refresh / email rate limits (all staff share the API's per-IP bucket)

  **Not applied to hosted yet:** it needs `SUPABASE_ACCESS_TOKEN` and the Gmail App Password in `.env`.
- Verification: 465 unit tests (use cases, schemas, bearer middleware, adapter error mapping, client options, route 401 / 422). Live token-free checks against hosted Supabase: 401 on logout / change-password without a token, `INVALID_RESET_CODE` from a real `verifyOtp`, a uniform 202 on forgot-password, and the new refresh message. Still to run with a test staff user: logout revokes the token and refresh, change-password ends other sessions, the full email reset. `scripts/smoke-api.sh` now covers logout.
- Docs: `api.md` (auth table, bodies, error codes, client flow); local `postman/` Auth folder (+4 requests, `newPassword` / `resetCode` variables). The mirror repo and cloud are not synced yet.

### 2026-10-11 — Lead → vehicle matches

- `GET /leads/:id/vehicle-matches?minScore=&limit=` for the lead detail screen: the linked car's score plus suggested cars (live, `open` / `linked`, same showroom, not the lead's own car, ≥ 2 criteria, ≥ `minScore`), newest 1000 scored. Same scorer and preference mapping (`toMatchPreference`) as the car-side endpoint; new `IMatchableVehicleLookup.listMatchCandidates`, implemented by `SupabaseVehicleMatchProfiles`. No migration. ADR-0013 updated.
- Verification: use-case unit tests (scope, exclusion, floor, limit, no-preference short-circuit). Not yet smoke-tested over HTTP against hosted data.

### 2026-10-11 — Follow-up completion, cancellation and listing

- Migration `20261011120000_follow_up_completion.sql` (applied to hosted 2026-10-10 via Supabase MCP as `follow_up_completion`; the 30 seeded completed rows had free-text outcomes and no actor, so the migration backfills them to `outcome = done`, text kept in `completion_notes`, `completed_by` = assignee): `follow_ups.completed_by` / `cancelled_by` / `completion_notes`; `outcome` constrained to `reached | no_answer | rescheduled | not_interested | done` and set exactly when `completed_at` is; `complete_follow_up` (closes, marks the reminder read, optionally schedules the next follow-up via `private.schedule_follow_up`) and `cancel_follow_up` (soft delete) RPCs, both raising `55000` → `409` when the follow-up is no longer open; `dashboard_summary` now judges each active lead by its **earliest** open follow-up (ADR-0012 amended), matching `nextFollowUp`.
- `FollowUp` entity gains a lifecycle (`open → completed | cancelled`, `422 FOLLOW_UP_CLOSED` on a second close) and `FollowUpOutcome` VO. New `IFollowUpQueries` read side; scheduling logic shared by schedule and complete (`build-scheduled-follow-up.ts`).
- Stored follow-ups may have no due reminder (49 of 52 seeded rows were inserted without one), so a reconstituted `FollowUp` has nullable `notificationId` / `dueAt`; only `FollowUp.schedule()` (typed `ScheduledFollowUp`) guarantees a reminder. Security advisors unchanged; performance adds two INFO unindexed FKs (`completed_by`, `cancelled_by`), like the other actor columns.
- Endpoints: `GET /leads/:id/follow-ups?status=`, `POST /leads/:id/follow-ups/:followUpId/complete`, `POST /leads/:id/follow-ups/:followUpId/cancel`. Follow-up responses now carry `status`, `outcome`, `completionNotes`, `completedAt`, `cancelledAt`.

### 2026-10-10 — Lead preference profile + vehicle match score

- Leads: the preference grows from catalog-only to a full profile in the terms a vehicle is recorded in — `preferredColours`, `preferredFuelTypes`, `preferredTransmissions`, `preferredBodyTypes`, `preferredYearMin/Max`, `preferredKmMax`, `preferredMaxOwners` (all optional; `budget` is the price ceiling). `LeadPreference` VO wraps `PreferredCatalog`; `Lead.setPreference` replaces it wholesale. Accepted on `POST /leads` and `PUT /leads/:id/preference` (full replace — omitted fields clear), returned on lead reads.
- `GET /leads/vehicle-matches/:vehicleId?minScore=&limit=`: scores every lead linked to the car and suggests open unlinked leads (`new` / `not_now` / `vehicle_unavailable`, same showroom, ≥ 2 criteria, ≥ `minScore`). Pure domain scorer `scoreLeadAgainstVehicle` (weights: catalog 30, budget 25, year 10, km 10, fuel 7, transmission 7, body 4, owners 4, colour 3; partial credit for near misses; blank criteria and an unpriced car's budget are skipped). Salesperson scope applies. ADR-0013.
- Vehicles implement the leads-owned `IMatchableVehicleLookup` (`SupabaseVehicleMatchProfiles`: vehicle + catalog names/body type + `vehicle_financials.listed_price`, read-only), wired in the composition root.
- Shared kernel: `FuelType` / `Transmission` moved from vehicles to `src/domain/shared`; new `BodyType` VO (catalog values incl. multi-valued cells like `crossover, suv`).
- Migration `20261010120000_lead_match_preferences.sql`: eight `leads` columns with CHECKs; `save_lead` recreated with eight trailing defaulted params. `scripts/seed-demo-leads.sql` fills demo preferences.
- Applied to hosted 2026-10-10; demo-lead preference update run (30 `+91984500` leads). Security advisors unchanged.
- Verification: 392 unit tests (scorer, VO, schemas, match use case incl. salesperson scope, route 401). A read-only script ran the real use case with `SupabaseLeadQueries` + `SupabaseVehicleMatchProfiles` against hosted data: priced Creta stock suggests the Creta lead at 86 and near-miss leads at 60–73; an unpriced car skips budget; the repository rebuilds `LeadPreference` from hosted rows. Authenticated HTTP calls still need the admin smoke run.
- Docs: `api.md`, `CONTEXT.md`, `schema.dbml`, local `postman/` collection (mirror repo + cloud not synced yet — run `/sync-postman`).

### 2026-10-08 — Dealer app handoff, round 2

Closes items 2–13 of the dealer app's `docs/BACKEND_HANDOFF.md` (2026-10-07 / 08 entries). Item 1, vehicle financials, stays on Stint 2.3; price filters wait for it.

- Leads: `PATCH /leads/:id` full-replace CRM edit (`Lead.updateDetails`; a new phone moves the lead to that phone's contact instead of rewriting a shared one). `DELETE /leads/:id/vehicle` (`Lead.removeVehicle`: `LEAD_CLOSED` on closed leads, `LEAD_REQUIRES_VEHICLE` on `booking_confirmed`; refreshes the vehicle's link state). `GET /leads/:id/status-history` (`ILeadStatusHistoryQueries`, actor name). `assignedToName` via `users!assigned_to`. List `search` (contact name/phone through `contacts!inner`), `budgetMin/Max`, `source` (multi), `hasVehicle`, `purchaseTimeline`, `financeRequired`, `createdFrom/To`.
- Vehicles: `linkedLeadCount` on list/get from the new read port `ILinkedLeadCounts` (one batch query per page, implemented by `ILeadQueries.countActiveByVehicles`, wired in the composition root). List/get read the `vehicle_list` view; `search` matches every word against plate + make/model/variant names; `makeId/modelId/variantId`, `yearMin/Max`, `kmMin/Max`, `fuelType`/`transmission` (multi).
- Owners: list `search` on name/phone/city.
- Shared: `SearchTerm` VO (`src/domain/shared`), `ilike-pattern` helper, `presentation/validation/search.schemas.ts` (search, CSV, boolean, instant, range, VO-backed number).
- Notifications: `leadId` on items, `isRead` filter, `unreadCount` on every list response.
- Auth: `GET /auth/me` returns `showroomId`. New read-only `showrooms` feature: `GET /showrooms`.
- Dashboard: salespersons get `200` with `scope: "mine"` (`dashboard_summary` already took `p_assignee_id`); `inStock`, `agedStock`, `inventory` are `null` for them.
- Migration `20261008120000_dealer_handoff_round_2.sql`: `notifications.lead_id` + BEFORE INSERT trigger (derives it from `lead` / `follow_up` entities, so `save_lead` / `schedule_follow_up` are untouched) + backfill; `vehicle_list` view (`security_invoker`). Applied to hosted 2026-10-08: both existing `follow_up_due` rows backfilled; the trigger was checked in a rolled-back transaction for both entity types. Tables/Views in `database.types.ts` now match the generator (RPC args keep their hand-tuned nullability). Security advisors unchanged; performance adds one INFO (`notifications_lead_id_fkey` unindexed, like the other FKs on cold delete paths).
- Verification: 361 unit tests; new routes mounted and 401 without a token; a read-only script ran the real Supabase query classes against hosted data (38 checks: vehicle multi-word search across plate + catalog names, catalog/year/km/fuel filters, lead contact search + filters, `assignedTo` embed, batch lead counts, lead history, notification `leadId` / `isRead` / unread count, owner search, showrooms). Authenticated end-to-end calls still need the admin smoke run.
- Follow-up: `pg_trgm` indexes if list search gets slow.

### 2026-10-06 — Dealer app handoff gaps

Closes five open items from the dealer app's `docs/BACKEND_HANDOFF.md` (vehicle financials deferred).

- `GET /vehicles` and `GET /vehicles/:id` return `frontImageUrl` / `frontImageUrlExpiresAt`: the lowest-`sortOrder` `front` photo, signed in one batch per page (`ObjectStoragePort.createSignedReadUrls`, `IVehicleMediaQueries.findFrontImagePaths`, `VehicleFrontImages` service). No per-row fan-out.
- `GET /leads` and `GET /leads/:id` embed `linkedVehicle` (`id`, make/model/variant names, year, registration) through `vehicles!vehicle_id` (the hint is required because `vehicles.sold_lead_id` also links the tables).
- Structured lead preference: `leads.preferred_make_id` / `preferred_model_id` / `preferred_variant_id` (FKs + chain CHECK + partial indexes), `PreferredCatalog` VO, `resolvePreferredCatalog` fills in parents from the narrowest id via the new `ICatalogLineageLookup` port (vehicles provides `SupabaseCatalogLineageLookup`). Accepted on `POST /leads` and the new `PUT /leads/:id/preference`; `GET /leads` filters by any of the three. `save_lead` recreated with three trailing defaulted params. Free-text `preferredVehicle` unchanged.
- `GET /vehicles/:id/status-history` items carry `changedByName` (`users!changed_by` embed).
- `vehicle_documents.file_name`: optional `fileName` on document confirm (`DocumentFileName` VO strips folder parts, 1–255 chars), returned on list/confirm.
- Migration `20261006120000_lead_preference_and_document_file_name.sql` applied to hosted 2026-10-06 (hosted `save_lead` matched the repo before replace; columns, indexes and the new `save_lead` signature verified). Generated types match the hand-edited `database.types.ts`; security advisors unchanged. Not replayed locally (Docker not running).

### 2026-10-05 — Admin dashboard (ADR-0012)

- `GET /dashboard?period=today|week|month|quarter&showroomId=` (admin only;
  salesperson 403). Returns period-to-date KPIs with `previous` (same elapsed
  span of the prior period), `attention` lists (overdue follow-ups, active
  leads without follow-up, aged stock > 45 days), `today` follow-ups,
  pipeline and inventory. Lists capped at 5 with `total`.
- New slice `src/features/dashboard/`; period windows resolved in
  `BUSINESS_TIMEZONE` (new env var, default `Asia/Kolkata`).
- Migration `20261005130000_dashboard_summary.sql`: `dashboard_summary`
  RPC (service_role only), `dashboard_vehicle_label` helper, indexes on
  status-history `(to_status, changed_at)` and open follow-ups. Verified
  against a seeded throwaway Postgres 17, then applied to hosted via
  Supabase MCP as version `20261005060133` (`dashboard_summary`); hosted
  call as `service_role` succeeds, `anon`/`authenticated` have no execute.
  Generated types match the hand-added `dashboard_summary` entry.
- Follow-ups are judged per active lead by its latest open follow-up
  (there is no completion endpoint yet).
- Deferred: revenue/profit/average price (Stint 5), salesperson view and
  team block, follow-up completion endpoint (done 2026-10-11).

### 2026-10-05 — Vehicle and lead status lifecycle (ADR-0011)

- Vehicle statuses replaced with `open` / `linked` / `dropped` / `sold`;
  inspection pipeline removed (only admins add vehicles). New vehicles
  start `open`. `vehicles.sold_lead_id` records the buying lead.
- Lead statuses replaced with `new` / `not_now` / `booking_confirmed` /
  `converted` / `lost` / `vehicle_unavailable`. `booking_confirmed` and
  `converted` require a vehicle.
- Coupling (application layer, idempotent order):
  - Active leads keep the vehicle `linked`; losing or moving the last one
    re-opens it.
  - Converting sells the vehicle and moves the other active leads on it to
    `vehicle_unavailable` (unlinked, revivable).
  - Admin drop of a linked vehicle answers `422 VEHICLE_HAS_LINKED_LEADS`
    with `details.linkedLeadCount`, then unlinks on `confirmUnlinkLeads`.
- `markVehicleSold` removed from `POST /leads/:id/status`; response is
  `{ status, vehicleSold }`. Leads may link only to `open`/`linked`
  vehicles (`VEHICLE_NOT_LINKABLE`).
- Ports: `ILinkableVehicleLookup`, `IVehicleLinkSync`, `IVehicleSale`
  (leads) and `ILinkedLeads` (vehicles); `LeadId` moved to
  `src/domain/shared`. `BusinessRuleViolationError` carries optional
  `details`, serialized in the 422 body.
- Migration `20261005120000_vehicle_lead_status_lifecycle.sql`: remaps
  existing rows, adds `sold_lead_id` + checks, recreates `save_vehicle`.
  Replayed on local Postgres 17 with all prior migrations and legacy seed
  rows, then applied to the hosted project.
- Docs: `api.md`, `schema.dbml`, `CONTEXT.md`, ADR-0011, ADR-0010 wording,
  `scripts/smoke-api.sh`.
- Postman: local `postman/`, the `autoLeadBackend-postman` repo (collection +
  README walkthrough) and the cloud **AutoLead API** collection are synced
  (Change Vehicle Status, Change Lead Status, Convert Lead). Cloud requests
  were patched in place so their scripts are kept.
- Migration applied to the hosted project via Supabase MCP (only test
  data existed: 1 vehicle → `linked`, leads → `new` / `lost`).
  `database.types.ts` checked against a fresh `generate_typescript_types`
  run (`sold_lead_id` FK is not one-to-one). Code is on branch
  `feat/vehicle-lead-status-lifecycle`; merging to `main` deploys it.
- Hosted already has `lead_assignment` (and its `user_id` fix); the earlier
  "pending" note was stale.

### 2026-10-04 — Salesperson access, lead assignment, inventory statuses

- Shared `ROLE` constants + `requireAnyRole` (`src/domain/shared/role.ts`);
  every policy delegates to it.
- Salesperson opened to catalog, vehicle intake (create/edit/media/docs),
  their own leads, and their own inbox. Admin-only: lead assignment,
  vehicle status, media/document delete, owner deactivate, staff.
- `AuthenticatedContext.showroomId` from `users.showroom_id`;
  `resolveShowroomId` defaults vehicles and leads to it. `showroomId` in
  create bodies is now optional; only admins may name another showroom.
- Vehicle graph: `approved → available → reserved → sold`,
  `reserved → available`, `on_hold ↔ available`; `sold` terminal.
- `PUT /leads/:id/assignment`; `assignedTo` on leads and list filter;
  salesperson-created leads self-assign; follow-ups go to the assignee.
- `POST /leads/:id/status` takes `markVehicleSold` (ADR-0006: vehicle
  first, retry-safe).
- `BusinessRuleViolationError` → `422` with a rule code (was `500` for
  closed-lead edits).
- Migration `20261004120000_lead_assignment.sql`: `save_lead` stores the
  assignee, records the real actor on `lead_status_history` (was the lead
  creator), and writes the `audit_logs` row and `lead_assigned`
  notification in the same transaction. Backward compatible with the
  deployed API. Replayed locally on Postgres 16 with all prior migrations.
- ADR-0006–0010 record cross-feature coordination, Contact extraction,
  registered-buyer leads, vehicle profit, and the marketplace module.
- api.md drift fixed: lead status / associate-vehicle responses,
  notification `entityType`, route count, "Not shipped" list.
- Fixed `GET/PATCH/DELETE /users/:id` and `PUT /users/:id/roles` answering
  `503` (PostgREST `PGRST201`): the `users → user_roles` embed needed the
  `!user_id` hint, the reverse of the 088f028 fix.
- `scripts/smoke-api.sh`: curl smoke of every route (token-free checks, plus
  the full staff flow when `ADMIN_EMAIL` / `ADMIN_PASSWORD` are set). Ran
  green (116/116) against all migrations on local Postgres 16 + PostgREST
  12.2.3; not yet run against the hosted project.
- Postman: request descriptions updated for the new role rules; the
  `autoLeadBackend-postman` repo and the cloud **AutoLead API** collection +
  **AutoLead Local** environment are synced with `postman/` (42 requests).

### 2026-10-04 — Vehicle media, documents, inspection lifecycle

- Admin inspection status graph on `Vehicle` (`submitted` →
  `inspection_pending` → `under_inspection` → `approved`, plus
  `on_hold` / `rejected` / `removed`). `POST /vehicles/:id/status` and
  paginated `GET /vehicles/:id/status-history`.
- `save_vehicle` now takes `p_reason` and records it on
  `vehicle_status_history` in the same transaction
  (`supabase/migrations/20261004014500_vehicle_media_lifecycle.sql`).
- Signed uploads via `ObjectStoragePort` + private buckets
  `vehicle-media` (10 MB jpeg/png/webp) and `vehicle-documents`
  (15 MB pdf/jpeg/png). Confirm writes `vehicle_media` /
  `vehicle_documents`; lists return short-lived signed read URLs.
- `available` / `reserved` / `sold`, salesperson access, acquisition
  prices, and orphan-object cleanup stay deferred.

### 2026-10-04 — Vercel production host

- Created Vercel project `autolead-backend` on team
  `abdul-hasib-ns-projects`, linked to GitHub `abdulhasibn/autoLeadBackend`
  (`main` → production). Region `bom1`. Node 22. Deployment protection off
  so API clients can call the host.
- Production URL: `https://autolead-backend-lyart.vercel.app` (`GET /health`
  returns 200). Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `LOG_LEVEL`.
- Fixed a startup crash: side-effect imports of `express-auth.d.ts` compiled
  to `require("…express-auth.d")`. Ambient types are included from
  `tsconfig.json` instead.
- Deferred: custom domain.

### 2026-10-04 — Frontend API guide

- Replaced the stale `docs/api.md` catalogue with the 30 shipped
  routes (Health, Auth, Users, Owners, Catalog, Vehicles, Leads,
  Notifications), request/response shapes, role gates, and how a
  frontend should start (login, admin screen order, client helper).

### 2026-10-04 — Postman repo + cloud sync

- Copied Catalog, Vehicles, Leads, and Notifications (plus env vars
  `showroomId` / `makeId` / `modelId` / `variantId` / `vehicleId` /
  `leadId` / `notificationId`) to
  [autoLeadBackend-postman](https://github.com/abdulhasibn/autoLeadBackend-postman).
- Replaced **AutoLead API** and **AutoLead Local** in Postman *My
  Workspace*. Request scripts that store tokens and IDs were restored
  after the collection replace.

### 2026-10-04 — Admin vehicle + lead first phase

- Admin catalog reads plus thin vehicle create/list/get/update
  (`src/features/vehicles/`). Status stays `submitted`. Seeded showroom
  `b0000000-0000-4000-8000-000000000001`.
- Admin walk-in leads (`src/features/leads/`): contact by phone, associate
  vehicle, status pipeline, follow-up. `schedule_follow_up` writes the
  follow-up and a `follow_up_due` notification in one transaction.
- Inbox (`src/features/notifications/`): list due reminders
  (`due_at` null or `<= now`) and mark read. Email/push deferred.
- Shared branded ids: `OwnerId`, `VehicleId`, `ShowroomId`, `NotificationId`.
- Postman Catalog / Vehicles / Leads / Notifications folders.
- Deferred: salesperson access; vehicle media/docs/lifecycle; commercial
  prices; lead assignment; owner portal.

### 2026-10-04 — Vehicle catalog seed from Shrey car dataset

- Restored paused hosted project `autolead` (`pptljtbxqzmjossuamve`), then
  loaded the spreadsheet into `makes` / `models` / `variants`.
- Variant rows now store ex-showroom price and factory specs
  (`supabase/migrations/20261003183826_seed_vehicle_catalog.sql`,
  `docs/schema.dbml`). Used-vehicle fields stay on `vehicles`.
- Loaded 38 makes, 263 models, 1,267 variants (1,276 sheet rows; 9 exact
  Mahindra XUV500 duplicates collapsed).
- Repaired split names: Land Rover / Range Rover*, Maruti Suzuki / Wagon R;
  stored BMW, MG, DC, ICML. "Not Mentioned" body/transmission stored as null.
  Lexus NX 300H length 4.64 m stored as 4640 mm.
- Deferred: vehicles feature; further catalog cleanup (0 cylinder counts,
  odd torque values, make/model spelling such as "Xuv500").

### 2026-10-03 — Standalone Postman GitHub repo

- Published Health, Auth, Users, and Owners collection plus the local
  environment to public repo
  [autoLeadBackend-postman](https://github.com/abdulhasibn/autoLeadBackend-postman),
  same pattern as gym-backend-postman. Local copies stay in `postman/`.
- Deferred: sync-postman skill (cloud `putCollection` on each feature).

### 2026-09-14 — Owners feature + first admin bootstrap

- Bootstrapped first admin Auth user `admin@example.com` (password matches
  Postman `password` variable) with `public.users` + admin `user_roles`
  via `save_staff_user`. Wired local `.env` with hosted URL, anon, and
  service-role keys.
- Owners module: `Owner` aggregate, command/query split, staff CRUD under
  `/owners`. Admin or salesperson for create/list/get/update; Admin-only
  deactivate. Duplicate live phone → 409 `CONFLICT`.
- 30 new unit tests (entity, policy, five use cases) — 106 total pass.
- Postman Owners folder in repo JSON; Create/List/Get/Update/Deactivate
  requests added on AutoLead API in My Workspace.
- Deferred: owner portal self-registration / `owners.user_id` linking;
  vehicle history on owner profile (needs vehicles); feature RLS.

### 2026-09-10 — Email + password auth (no OTP)

- Replaced phone SMS OTP with `POST /auth/login` and `POST /auth/refresh`.
  Invalid credentials → 401 `INVALID_CREDENTIALS`.
- Shared `Email` and `Password` VOs; JWT identity + live `user_roles` unchanged.
- Create staff requires email + password; Auth user is email-only
  (`email_confirm: true`). Phone stays a profile field.
- Update staff requires email and syncs Auth email when it changes.
- Unique live-email index `users_email_active_uidx` applied to hosted project.
- Postman Auth folder is Login / Refresh / Me; Create Staff sends password.
- Deferred: password reset / change-own-password; Google; owner self-signup;
  first-admin bootstrap.

### 2026-09-10 — Postman collection for current APIs

- Created **AutoLead API** in Postman *My Workspace* plus **AutoLead Local**
  (`baseUrl` `http://localhost:3000`).
- Folders: Health, Auth (OTP send/verify/me), Users (staff CRUD).
- Verify OTP saves `accessToken` / `refreshToken`; Create Staff saves
  `staffUserId`.
- Repo copies: `postman/AutoLead-API.postman_collection.json`,
  `postman/AutoLead-Local.postman_environment.json`.
- Deferred: Owners and later feature folders; first-admin bootstrap so
  Users requests succeed.

### 2026-09-10 — Resolve roles from user_roles (gym-style)

- JWT is identity only. `ITokenVerifier` returns `UserId`; it no longer reads `app_metadata.roles`.
- `AuthenticateActorUseCase` loads live roles from `public.user_roles` (excludes soft-deleted users and grants).
- Bearer middleware calls that use case; role changes apply on the next request.
- Custom Access Token Hook is unused by the API and no longer a setup step. The SQL function remains in the database.
- Deferred: drop or leave the unused hook function.

### 2026-09-10 — Users feature module (`src/features/users`)

- Staff aggregate: `StaffRole` VO (`admin` | `salesperson`) and `StaffUser` entity (role set, profile, soft-deactivate).
- Ports: `IUserRepository` (find/save/countLiveWithRole), `IStaffQueries` (list/get read models), `IAuthUserProvisioner` (Auth admin create/update/disable/delete).
- Use cases: create, update, replace roles, deactivate, list, get — all gated by `AdminStaffPolicy`.
- Last-admin and self-deactivate protected (`LastAdminProtectedError` → 409).
- Routes: `POST/GET /users`, `GET/PATCH/DELETE /users/:id`, `PUT /users/:id/roles`.
- Atomic save via `private.save_staff_user` + `public.save_staff_user` wrapper (service_role only); applied to hosted project.
- Promoted `Phone`, `requireAuth` / `Request.auth`, and `ForbiddenActionError` (403) out of auth so later features do not import auth internals.
- 38 new unit tests (VO, entity, policy, six use cases) — 61 total pass.
- Deferred: first-admin bootstrap/seed, JWT role claims refresh until next login, feature RLS, showroom required on staff, HTTP tests against Docker Supabase.

### 2026-09-04 — Auth feature module (`src/features/auth`)

- `Phone` value object (E.164, private ctor, static create).
- `AuthenticatedContext` in `src/domain/shared/` for cross-feature use.
- Ports: `IAuthProvider` (OTP send/verify), `ITokenVerifier` (JWT → context), `IAuthQueries` (profile lookup).
- Use cases: `SendOtpUseCase`, `VerifyOtpUseCase`, `GetMeUseCase`.
- `SupabaseAuthAdapter` (anon client): OTP via `signInWithOtp` + `verifyOtp`; token via `getUser`.
- `SupabaseAuthQueries` (service-role client): profile lookup from `public.users`.
- `bearer.middleware.ts` (Presentation): validates JWT via `ITokenVerifier`, attaches `req.auth`.
- `OtpVerificationError` → 401 via feature error mapper registered in composition.
- Routes: `POST /auth/otp/send`, `POST /auth/otp/verify`, `GET /auth/me`.
- Express `Request` augmented with `req.auth?: AuthenticatedContext` via declaration merging.
- Updated `composition-root.ts` and `routes.ts` to wire auth feature.
- 21 unit tests: `Phone` VO (9), `SendOtpUseCase` (4), `VerifyOtpUseCase` (4), `GetMeUseCase` (2) — all pass.
- Deferred: custom access token hook dashboard enablement, `.env` wiring, RLS feature policies.

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
