# AutoLead API — frontend guide

What is live today, and how a frontend (admin web first) can start against it.

**Current phase:** admin vehicle + walk-in lead management. There is no public marketplace, owner portal, salesperson assignment, vehicle media, or production host yet.

**Base URL:** `http://localhost:3000`  
**Postman:** [autoLeadBackend-postman](https://github.com/abdulhasibn/autoLeadBackend-postman) (also **AutoLead API** + **AutoLead Local** in Postman *My Workspace*)

---

## How frontend apps should start

### 1. Point at the local API

The backend allows any browser origin (`cors()` with defaults). Start the API with `pnpm dev` on port `3000`.

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
```

Use JSON only. Send `Content-Type: application/json` on bodies.

### 2. Sign in as the bootstrap admin

The hosted project is seeded with:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `secret12` |
| Role | `admin` |
| Seeded showroom | `b0000000-0000-4000-8000-000000000001` |

```http
POST /auth/login
{ "email": "admin@example.com", "password": "secret12" }
```

Store `accessToken` and `refreshToken`. Attach the access token on every staff request:

```http
Authorization: Bearer <accessToken>
```

Call `GET /auth/me` after login. **Roles live on the user row, not in the JWT.** Gate screens from `me.roles`, not from a decoded token.

When a request returns `401 AUTHENTICATION_FAILED`, call `POST /auth/refresh` with the refresh token. On success, replace both tokens. If refresh fails, send the user to login.

### 3. Build the admin screens in this order

This matches the APIs that exist and the intended first-phase flow.

1. **Login / session** — login, refresh, me, logout (drop tokens locally).
2. **Catalog pickers** — makes → models → variants (cascading selects).
3. **Owners** — create/list/get/update (needed before a vehicle).
4. **Vehicles** — create a second-hand car from a catalog variant + owner.
5. **Leads** — create walk-in contact, attach a vehicle, change status, schedule a follow-up.
6. **Inbox** — list due notifications and mark them read.
7. **Staff (admin settings)** — optional; create other admins/salespeople.

Do **not** start a buyer marketplace, owner self-serve portal, or salesperson inbox. Those APIs are not shipped.

### 4. Recommended client shape

```ts
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message ?? 'Request failed'), {
      status: res.status,
      code: body.error?.code,
    });
  }
  return body as T;
}
```

Treat `422 VALIDATION_ERROR` as a form error (the API does **not** return field-level details). Treat `409` as a uniqueness conflict (duplicate phone, email, or registration). Treat `403 FORBIDDEN` as a role problem.

### 5. Smoke the same path as Postman

Login → Create Owner → List Makes → List Models → List Variants → Create Vehicle → Create Lead → Associate Vehicle → Schedule Follow-up → Change Status → List Notifications.

Follow-up reminders stay hidden until `dueAt` (same as `scheduledAt`). For local UI testing, schedule a time in the past or wait.

---

## Shared conventions

| Item | Rule |
|------|------|
| Content-Type | `application/json` |
| Auth | `Authorization: Bearer <accessToken>` unless marked public |
| Errors | `{ "error": { "code": string, "message": string } }` — no field errors |
| Pagination | Query `limit` (default **20**, max **100**), `offset` (default **0**) |
| Page shape | `{ items, total, limit, offset }` |
| IDs | UUID strings |
| Dates | ISO-8601 UTC (`2026-10-10T10:00:00.000Z`) except insurance date (`YYYY-MM-DD`) |
| Phone | E.164, e.g. `+919876543210` |
| Email | trimmed, lowercased, `local@domain.tld` |
| Password | at least 8 characters |
| Soft delete | Deactivate endpoints return `204`. Deactivated rows do not appear in lists. |

### Roles

| Role | Meaning today |
|------|----------------|
| `admin` | Full staff API in this phase |
| `salesperson` | Owners create/list/get/update only. Cannot deactivate owners or use catalog/vehicles/leads/notifications/users. |
| `owner` / `buyer` | Seeded in the database. **No HTTP API yet.** |

### HTTP error codes

| Status | Code | When |
|--------|------|------|
| 401 | `AUTHENTICATION_FAILED` | Missing/invalid/expired bearer |
| 401 | `INVALID_CREDENTIALS` | Bad email/password or refresh token |
| 403 | `FORBIDDEN` | Authenticated but wrong role |
| 404 | `NOT_FOUND` | Unknown or deactivated id |
| 409 | `CONFLICT` / `UNIQUE_VIOLATION` | Duplicate live phone, email, or registration |
| 409 | `LAST_ADMIN_PROTECTED` | Would remove the last admin, or deactivate yourself |
| 422 | `VALIDATION_ERROR` | Body/query/params failed Zod |
| 422 | `INVALID_LEAD_STATUS_TRANSITION` | Illegal lead status jump |
| 503 | `DB_UNAVAILABLE` / `DB_TRANSIENT` | Database down or retryable |

---

## Endpoint catalogue

**30 routes** are mounted.

### Health — public

| Method | Path | Auth | Success |
|--------|------|------|---------|
| `GET` | `/health` | Public | `200` `{ status: "ok", timestamp }` |

Use this as the frontend “API is up” check.

### Auth

| Method | Path | Auth | Success |
|--------|------|------|---------|
| `POST` | `/auth/login` | Public | `200` `{ accessToken, refreshToken }` |
| `POST` | `/auth/refresh` | Public | `200` `{ accessToken, refreshToken }` (old refresh token is rotated) |
| `GET` | `/auth/me` | Bearer | `200` profile |

**Login / refresh body**

```json
{ "email": "admin@example.com", "password": "secret12" }
```

```json
{ "refreshToken": "<refreshToken>" }
```

**Me**

```json
{
  "id": "uuid",
  "fullName": "Admin",
  "phone": "+9198…",
  "email": "admin@example.com",
  "avatarUrl": null,
  "roles": ["admin"]
}
```

### Users — Admin only

Staff CRUD. Roles on create/replace: `admin` \| `salesperson`.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/users` | `201` staff |
| `GET` | `/users` | `200` page |
| `GET` | `/users/:id` | `200` staff |
| `PATCH` | `/users/:id` | `200` staff |
| `PUT` | `/users/:id/roles` | `200` staff |
| `DELETE` | `/users/:id` | `204` |

**Create body**

```json
{
  "fullName": "Ada Lovelace",
  "phone": "+919876543211",
  "email": "ada@example.com",
  "password": "secret12",
  "showroomId": null,
  "roles": ["salesperson"]
}
```

**Update body:** `fullName`, `phone`, `email` (required), `showroomId` (UUID or `null`).  
**Replace roles body:** `{ "roles": ["salesperson"] }` — at least one role.  
**List query:** `limit`, `offset`, optional `role=admin` or `role=salesperson`.

**Staff object**

```json
{
  "id": "uuid",
  "fullName": "Ada Lovelace",
  "phone": "+919876543211",
  "email": "ada@example.com",
  "showroomId": null,
  "roles": ["salesperson"],
  "createdAt": "2026-10-04T00:00:00.000Z"
}
```

Cannot deactivate yourself or drop the last admin (`409 LAST_ADMIN_PROTECTED`).

### Owners — Admin or Salesperson (deactivate is Admin)

Phone is the unique live key.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/owners` | `201` owner |
| `GET` | `/owners` | `200` page |
| `GET` | `/owners/:id` | `200` owner |
| `PATCH` | `/owners/:id` | `200` owner |
| `DELETE` | `/owners/:id` | `204` (Admin) |

**Create / update body**

```json
{
  "fullName": "Priya Shah",
  "phone": "+919876543210",
  "email": "priya@example.com",
  "address": "12 MG Road",
  "city": "Bengaluru",
  "preferredContactMethod": "whatsapp",
  "altPhone": null,
  "idInfo": null,
  "notes": null
}
```

`preferredContactMethod`: `phone` \| `email` \| `whatsapp` \| `null`.  
**List query:** `limit`, `offset`, optional `city`, optional `phone` (E.164).

**Owner object** also includes `id`, `userId` (null until owner portal), `createdBy`, `createdAt`, `updatedAt`. Duplicate live phone → `409`.

### Catalog — Admin only

Read-only factory catalog. Use these to populate vehicle create.

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/catalog/makes` | `200` page of `{ id, name }` |
| `GET` | `/catalog/makes/:makeId/models` | `200` page of `{ id, makeId, name }` |
| `GET` | `/catalog/models/:modelId/variants` | `200` page of variant |

**Variant**

```json
{
  "id": "uuid",
  "modelId": "uuid",
  "name": "320d",
  "fuelType": "diesel",
  "transmission": "automatic",
  "exShowroomPrice": 4500000
}
```

`fuelType` / `transmission` / `exShowroomPrice` can be `null` on some seed rows. Pagination: `limit`, `offset`.

### Vehicles — Admin only

Creates a second-hand car. Status is always `submitted` on create. No media, documents, inspection, or lifecycle transitions yet.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/vehicles` | `201` vehicle (`makeName` / `modelName` / `variantName` are `null` until you GET) |
| `GET` | `/vehicles` | `200` page (includes catalog names) |
| `GET` | `/vehicles/:id` | `200` vehicle |
| `PATCH` | `/vehicles/:id` | `200` vehicle (second-hand fields only; cannot change owner/variant/showroom/status) |

**Create body**

```json
{
  "showroomId": "b0000000-0000-4000-8000-000000000001",
  "ownerId": "<owner uuid>",
  "variantId": "<variant uuid>",
  "year": 2019,
  "registrationNumber": "KA01AB1234",
  "fuelType": "petrol",
  "transmission": "manual",
  "kmDriven": 42000,
  "numPreviousOwners": 1,
  "colour": "White",
  "insuranceValidUntil": null,
  "rcStatus": "clear",
  "serviceHistory": "full",
  "accidentHistory": false,
  "loanStatus": "clear",
  "location": "Bengaluru",
  "description": null,
  "acquisitionType": "consignment"
}
```

**Update body** is the same minus `showroomId`, `ownerId`, `variantId`, `acquisitionType`. `accidentHistory` is required on update.

**List query:** `limit`, `offset`, optional `status`, `ownerId`, `showroomId`, `registration`.

**Enums**

| Field | Values |
|-------|--------|
| `fuelType` | `petrol`, `diesel`, `cng`, `electric`, `hybrid` |
| `transmission` | `manual`, `automatic`, `amt`, `cvt`, `dct` |
| `acquisitionType` | `dealership_purchase`, `consignment`, `intermediary_sale` |
| `rcStatus` | `clear`, `hypothecation`, `under_transfer` (or `null`) |
| `serviceHistory` | `full`, `partial`, `none`, `unknown` (or `null`) |
| `loanStatus` | `clear`, `active` (or `null`) |
| `status` (read-only today) | `submitted` on create. Filter also accepts `inspection_pending`, `under_inspection`, `approved`, `available`, `reserved`, `sold`, `rejected`, `on_hold`, `removed` |

**Rules:** year `1900–2100`; `kmDriven` ≥ 0 integer; `numPreviousOwners` `0–32767`; registration uppercase alphanumeric, max 16, spaces stripped; `ownerId` / `variantId` / `showroomId` must exist. Duplicate live registration → `409`.

**Vehicle object** (GET)

```json
{
  "id": "uuid",
  "showroomId": "uuid",
  "ownerId": "uuid",
  "variantId": "uuid",
  "makeName": "BMW",
  "modelName": "3 Series",
  "variantName": "320d",
  "year": 2019,
  "registrationNumber": "KA01AB1234",
  "fuelType": "petrol",
  "transmission": "manual",
  "kmDriven": 42000,
  "numPreviousOwners": 1,
  "colour": "White",
  "insuranceValidUntil": null,
  "rcStatus": "clear",
  "serviceHistory": "full",
  "accidentHistory": false,
  "loanStatus": "clear",
  "location": "Bengaluru",
  "description": null,
  "status": "submitted",
  "acquisitionType": "consignment",
  "submittedBy": "uuid",
  "createdAt": "…",
  "updatedAt": "…"
}
```

### Leads — Admin only

Walk-in contact keyed by phone. Creating a lead with an existing live phone reuses that contact and refreshes name/email.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/leads` | `201` lead (`nextFollowUp` is `null`) |
| `GET` | `/leads` | `200` page |
| `GET` | `/leads/:id` | `200` lead (includes `nextFollowUp` if scheduled) |
| `PATCH` | `/leads/:id/vehicle` | `200` lead |
| `POST` | `/leads/:id/follow-ups` | `201` follow-up |
| `POST` | `/leads/:id/status` | `200` lead |

**Create body**

```json
{
  "showroomId": "b0000000-0000-4000-8000-000000000001",
  "fullName": "Rahul Sharma",
  "phone": "+919811122233",
  "email": null,
  "source": "phone",
  "vehicleId": null,
  "budget": 800000,
  "preferredVehicle": null,
  "purchaseTimeline": null,
  "financeRequired": false,
  "currentVehicle": null,
  "tradeInRequired": false,
  "notes": "called the showroom"
}
```

`source`: `marketplace`, `mobile_app`, `website`, `phone`, `walkin`, `whatsapp`, `instagram`, `facebook`, `referral`, `other`.  
**List query:** `limit`, `offset`, optional `status`, `vehicleId`.  
**Associate vehicle:** `{ "vehicleId": "<uuid>" }` — vehicle must exist.  
**Schedule follow-up:** `{ "scheduledAt": "2026-10-10T10:00:00.000Z", "taskType": "call", "notes": null }`  
`taskType`: `call`, `whatsapp`, `meeting`, `test_drive`, `send_quotation`, `other`.  
This also writes a `follow_up_due` notification for the caller, due at `scheduledAt`.  
**Change status:** `{ "status": "contacted", "notes": null }`

**Lead object**

```json
{
  "id": "uuid",
  "showroomId": "uuid",
  "vehicleId": null,
  "contactId": "uuid",
  "contactFullName": "Rahul Sharma",
  "contactPhone": "+919811122233",
  "contactEmail": null,
  "source": "phone",
  "status": "new",
  "budget": 800000,
  "preferredVehicle": null,
  "purchaseTimeline": null,
  "financeRequired": false,
  "currentVehicle": null,
  "tradeInRequired": false,
  "notes": "called the showroom",
  "nextFollowUp": { "id": "uuid", "taskType": "call", "scheduledAt": "…", "notes": null },
  "createdBy": "uuid",
  "createdAt": "…",
  "updatedAt": "…"
}
```

New leads start at `new`. Allowed transitions (skipping a step → `422 INVALID_LEAD_STATUS_TRANSITION`):

```text
new            → contacted | lost | not_interested | no_response
contacted      → interested | lost | not_interested | no_response
interested     → follow_up | lost | not_interested | no_response
follow_up      → test_drive | lost | not_interested | no_response
test_drive     → negotiation | lost
negotiation    → booking_confirmed | lost
booking_confirmed → sold | lost
sold / lost / not_interested / no_response  → (terminal)
```

**Follow-up create response**

```json
{
  "id": "uuid",
  "leadId": "uuid",
  "assignedTo": "uuid",
  "taskType": "call",
  "scheduledAt": "2026-10-10T10:00:00.000Z",
  "notes": null,
  "notificationId": "uuid",
  "dueAt": "2026-10-10T10:00:00.000Z"
}
```

### Notifications — Admin only

Inbox for the **signed-in user**. Items with a future `dueAt` are omitted.

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/notifications` | `200` page |
| `PATCH` | `/notifications/:id/read` | `204` (own notifications only) |

```json
{
  "id": "uuid",
  "type": "follow_up_due",
  "title": "…",
  "body": null,
  "entityType": "lead",
  "entityId": "<lead uuid>",
  "isRead": false,
  "dueAt": "2026-10-10T10:00:00.000Z",
  "createdAt": "…"
}
```

Poll `GET /notifications` on the admin home screen. Use `entityId` to deep-link to the lead.

---

## Suggested admin UI map

| Screen | Endpoints |
|--------|-----------|
| Login | `POST /auth/login`, then `GET /auth/me` |
| App shell | `GET /auth/me` for name + roles; `GET /notifications` badge |
| Owners list / form | `GET/POST/PATCH /owners`, `GET /owners/:id` |
| Vehicle create | `GET /catalog/makes` → models → variants, then `POST /vehicles` |
| Vehicle list / detail | `GET /vehicles`, `GET /vehicles/:id`, `PATCH /vehicles/:id` |
| Lead pipeline | `GET /leads?status=`, `POST /leads`, `PATCH /leads/:id/vehicle`, `POST /leads/:id/status`, `POST /leads/:id/follow-ups` |
| Inbox | `GET /notifications`, `PATCH /notifications/:id/read` |
| Staff settings | `/users` (admin only) |

Hide catalog, vehicles, leads, notifications, and users when `me.roles` has no `admin`. Show owners for `admin` or `salesperson`.

---

## Not shipped yet — do not design screens against these

- Owner self-registration / portal (`owners.userId` linking)
- Salesperson lead assignment and scoped inbox
- Vehicle media, documents, inspection, or status lifecycle
- Acquisition prices / finance
- Marketplace / buyer browse
- Password reset or change-own-password
- Production URL (Vercel not deployed)

Those stay on the backend roadmap (`docs/MVP_ROADMAP.md`). If you need a contract for a later screen, wait until the matching folder appears in this file and in Postman.
