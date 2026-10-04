# MVP Execution Roadmap

> **Agents:** Prefer this over inventing build order. Source of truth for product behavior is [`PRD.md`](../PRD.md); stage status stays in [`PROGRESS.md`](PROGRESS.md).

**Scope:** Backend API MVP in this repo (`src/features/*`). Schema source of truth: [`schema.dbml`](schema.dbml). Migrations live in `supabase/migrations/` (stints 1–6 applied on hosted `autolead`).

**Rule:** Finish a stint's exit criteria before starting the next. Items inside a stint are listed in build order — do them one by one.

```
Foundation (shipped)
  → Stint 1 Identity
  → Stint 2 Owners & Vehicles
  → Stint 3 Inventory & Marketplace
  → Stint 4 Leads & Sales
  → Stint 5 Finance
  → Stint 6 Notifications & Audit
```

---

## Foundation (shipped)

| Module | Feature | Status |
|--------|---------|--------|
| Infra | `src/app/*`, shared kernel, health route | Done |
| Docs | `architecture.md`, ADR-0001, ADR-0005 | Done |

**Exit criteria:** `pnpm test` / `pnpm build` pass; `GET /health` returns 200.

---

## Stint 1 — Identity

**Outcome:** Users can authenticate; Admin can manage staff; roles (Admin, Salesperson, Owner, Buyer) are enforced.

| # | Work item | Paths | PRD | Status |
|---|-----------|-------|-----|--------|
| 1.1 | Supabase project + identity migration (users, roles) | `supabase/migrations/`, `docs/schema.dbml` | §5, §6 | Done |
| 1.2 | Auth: OTP / session, Bearer middleware, `/auth/me` | `src/features/auth/` | §5 | Done (email + password; OTP deferred) |
| 1.3 | Users: staff CRUD, role assignment (Admin) | `src/features/users/` | §5.1, §5.2 | Done |

**Exit criteria:** Admin OTP sign-in → create salesperson → authenticated request carries role; unauthorized roles rejected.

---

## Stint 2 — Owners & Vehicles

**Outcome:** Salesperson can register owners and submit vehicles; lifecycle states tracked.

| # | Work item | Paths | PRD | Status |
|---|-----------|-------|-----|--------|
| 2.1 | Owner CRUD + Owner portal profile | `src/features/owners/` | §7, §8 | Partial — staff CRUD done; portal Todo |
| 2.2 | Vehicle submission, details, media, documents | `src/features/vehicles/` | §9, §10 | Done (staff) |
| 2.3 | Acquisition type + commercial details | `vehicles` | §9.2, §9.3 | Partial — acquisition type done; prices Todo |

**Exit criteria:** Salesperson registers owner → submits vehicle → vehicle moves through initial lifecycle states.

---

## Stint 3 — Inventory & Marketplace

**Outcome:** Approved vehicles are publicly listable; buyers can search, filter, and view details.

| # | Work item | Paths | PRD | Status |
|---|-----------|-------|-----|--------|
| 3.1 | Inventory management (status, pricing, listing guard) | `src/features/inventory/` | §9, §10 | Partial — `available` / `reserved` / `sold` transitions shipped on `vehicles`; pricing and listing guard Todo |
| 3.2 | Public marketplace: browse, search, filter | `src/features/marketplace/` | §11 | Todo |
| 3.3 | Vehicle detail page API | `marketplace` | §12 | Todo |
| 3.4 | Showroom info (name, address, hours) | `marketplace` or `config` slice | §32 | Todo |

**Exit criteria:** Listed vehicle appears in public search; detail page returns full public fields; internal-only data not exposed.

---

## Stint 4 — Leads & Sales

**Outcome:** Buyer inquiry creates internal lead; salesperson manages follow-ups and test drives.

| # | Work item | Paths | PRD | Status |
|---|-----------|-------|-----|--------|
| 4.1 | Buyer registration + saved vehicles | buyer slice in `owners` or dedicated | §14–§16 | Todo |
| 4.2 | Buyer inquiry → internal lead creation | `src/features/leads/` | §17, §19, §20 | Todo |
| 4.3 | Lead assignment, status pipeline, follow-ups | `leads` | §21–§23 | Done — admin assignment, salesperson-scoped leads, follow-ups to assignee |
| 4.4 | Test drive requests | `leads` or `sales` | §24 | Todo |
| 4.5 | Salesperson dashboard queries | `src/features/sales/` | §25 | Todo |

**Exit criteria:** Buyer submits inquiry on listed vehicle → lead appears for Admin/Salesperson → assign → follow-up → status update.

---

## Stint 5 — Finance

**Outcome:** Vehicle-level costs, revenue, and profit tracked; basic P&L reporting.

| # | Work item | Paths | PRD | Status |
|---|-----------|-------|-----|--------|
| 5.1 | Vehicle expenses + revenue per vehicle | `src/features/finance/` | §27 | Todo |
| 5.2 | Profit calculation (dealership-owned vs consignment) | `finance` | §27.3 | Todo |
| 5.3 | Business expenses + income | `finance` | §28, §29 | Todo |
| 5.4 | Basic P&L report query | `finance` | §30 | Todo |

**Exit criteria:** Sold vehicle shows cost breakdown, selling price, and computed profit; monthly P&L query returns expected totals.

---

## Stint 6 — Platform

**Outcome:** Internal notifications fire for key events; sensitive actions are audited.

| # | Work item | Paths | PRD | Status |
|---|-----------|-------|-----|--------|
| 6.1 | Notifications (in-app / email for MVP) | `src/features/notifications/` | §33 | Partial — in-app inbox for staff; `follow_up_due` + `lead_assigned`. Email Todo |
| 6.2 | Audit trail writes (status changes, assignments, financial) | cross-cutting in use cases | §38 | Partial — status history tables + lead assignment in `audit_logs`; financial Todo |
| 6.3 | Admin dashboard aggregate queries | `sales` / reporting slice | §26 | Todo |

**Exit criteria:** Lead assignment triggers salesperson notification; vehicle status change writes audit row; Admin dashboard returns inventory/lead/sales summaries.

---

## Out of orbit (deferred)

Not in these stints — do not pull forward unless a concrete blocker appears:

- Multi-showroom support (PRD §36 Phase 2)
- WhatsApp / SMS integration
- Push notifications
- Automated lead assignment
- Advanced test-drive scheduling
- EMI calculator
- Buyer recommendations / price-drop alerts
- Vehicle comparison
- AI sales intelligence / call transcription (PRD §37)
- Feature-scoped RLS beyond defense-in-depth (service-role API for now)

Update this file and [`PROGRESS.md`](PROGRESS.md) **Current stage** when a stint item ships.
