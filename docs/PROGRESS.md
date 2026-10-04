# Project Progress Log

> **Agents:** Read the **Current stage** section first. Append a new log entry when you complete a meaningful chunk of work (schema, feature, infra). Keep entries newest-first under the log. Do not rewrite history — only amend **Current stage** / **Next up**.

## Current stage

**Stage:** **Staff vehicle + lead phase** — admin and salesperson intake, inspection and inventory statuses, walk-in leads with assignment, staff inbox.

| Area | Status |
|------|--------|
| Repo scaffold (Express / TS / Vitest / CI) | Done |
| Architecture docs + ADR-0001 / ADR-0005 / ADR-0006–0010 | Done |
| Cursor rules (architecture, quality, errors, testing, database, git) | Done |
| Supabase project | Done (`autolead`, `ap-south-1`) |
| SQL migrations (stints 1–6 + save_staff_user + email unique + catalog seed + admin vehicles/leads + media lifecycle + lead assignment) | 11 applied to hosted project; `20261004120000_lead_assignment` pending apply |
| Schema source of truth (`docs/schema.dbml`) | Done |
| Generated `database.types.ts` | Done |
| Local `.env` with service role key | Done — local dev only, not committed |
| Auth feature (`src/features/auth`) | Done — email + password login/refresh, bearer, /auth/me; roles from `user_roles` |
| Users / roles (`src/features/users`) | Done — staff CRUD + email/password provision (Admin) |
| Owners (`src/features/owners`) | Done — staff owner CRUD (Admin / Salesperson; deactivate Admin-only) |
| Vehicles (`src/features/vehicles`) | Staff create/list/get/update, catalog reads, signed media/document uploads; Admin status changes (inspection + `available` / `reserved` / `sold`) and deletes |
| Inventory (`src/features/inventory`) | Not started |
| Marketplace (`src/features/marketplace`) | Not started |
| Leads (`src/features/leads`) | Staff walk-in create, associate vehicle, status (optional vehicle sale), follow-up + due notification; Admin assignment; salesperson sees assigned leads only |
| Sales (`src/features/sales`) | Not started |
| Finance (`src/features/finance`) | Not started |
| Notifications (`src/features/notifications`) | Staff inbox (`due_at` filter) + mark read; `follow_up_due`, `lead_assigned` |
| Audit trail (cross-cutting) | Partial — status history tables; lead assignment in `audit_logs` |
| Postman collection (Health, Auth, Users, Owners, Catalog, Vehicles, Leads, Notifications) | Done — local `postman/`, GitHub repo, cloud My Workspace |
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
| Tables | 25 |
| Migrations applied | 11 (previous 10 + vehicle_media_lifecycle); 12th (`lead_assignment`) pending |
| Roles seeded | admin, salesperson, owner, buyer |

## Next up

1. Apply `20261004120000_lead_assignment.sql` to the hosted project, then merge.
2. Acquisition prices on `vehicle_financials` (Stint 2.3).
3. Inventory listing guard + pricing (Stint 3.1), then the public marketplace module (ADR-0010).

## Log

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
