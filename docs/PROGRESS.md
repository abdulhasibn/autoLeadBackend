# Project Progress Log

> **Agents:** Read the **Current stage** section first. Append a new log entry when you complete a meaningful chunk of work (schema, feature, infra). Keep entries newest-first under the log. Do not rewrite history — only amend **Current stage** / **Next up**.

## Current stage

**Stage:** **Admin vehicle + lead first phase** — catalog intake, thin vehicles, walk-in leads, follow-up due inbox.

| Area | Status |
|------|--------|
| Repo scaffold (Express / TS / Vitest / CI) | Done |
| Architecture docs + ADR-0001 / ADR-0005 | Done |
| Cursor rules (architecture, quality, errors, testing, database, git) | Done |
| Supabase project | Done (`autolead`, `ap-south-1`) |
| SQL migrations (stints 1–6 + save_staff_user + email unique + catalog seed + admin vehicles/leads) | Done — applied to hosted project |
| Schema source of truth (`docs/schema.dbml`) | Done |
| Generated `database.types.ts` | Done |
| Local `.env` with service role key | Done — local dev only, not committed |
| Auth feature (`src/features/auth`) | Done — email + password login/refresh, bearer, /auth/me; roles from `user_roles` |
| Users / roles (`src/features/users`) | Done — staff CRUD + email/password provision (Admin) |
| Owners (`src/features/owners`) | Done — staff owner CRUD (Admin / Salesperson; deactivate Admin-only) |
| Vehicles (`src/features/vehicles`) | Admin create/list/get/update + catalog reads; no media, documents, or lifecycle API |
| Inventory (`src/features/inventory`) | Not started |
| Marketplace (`src/features/marketplace`) | Not started |
| Leads (`src/features/leads`) | Admin walk-in create, associate vehicle, status, follow-up + mandatory due notification |
| Sales (`src/features/sales`) | Not started |
| Finance (`src/features/finance`) | Not started |
| Notifications (`src/features/notifications`) | Admin inbox (`due_at` filter) + mark read |
| Audit trail (cross-cutting) | Not started |
| Postman collection (Health, Auth, Users, Owners, Catalog, Vehicles, Leads, Notifications) | Done — local `postman/`, GitHub repo, cloud My Workspace |
| Frontend API guide (`docs/api.md`) | Done — current endpoints + how to start |
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
| Migrations applied | 10 (previous 9 + admin_vehicles_leads) |
| Roles seeded | admin, salesperson, owner, buyer |

## Next up

1. Vehicle media, documents, and lifecycle (rest of Stint 2.2).
2. Salesperson lead assignment + scoped inbox.
3. Acquisition prices on `vehicle_financials` (Stint 2.3).

## Log

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
