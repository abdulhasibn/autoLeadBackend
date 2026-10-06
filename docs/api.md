# AutoLead API — frontend guide

What is live today, and how a frontend (admin web first) can start against it.

**Current phase:** staff (admin + salesperson) vehicle intake, inspection, inventory listing statuses, and walk-in lead management with assignment. There is no public marketplace or owner portal yet.

**Base URL:** `http://localhost:3000`  
**Production:** `https://autolead-backend-lyart.vercel.app` (deploys from `main`)  
**Postman:** `postman/` in this repo, mirrored at [autoLeadBackend-postman](https://github.com/abdulhasibn/autoLeadBackend-postman) (also **AutoLead API** + **AutoLead Local** in Postman *My Workspace*)

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
4. **Vehicles** — create a second-hand car, add photos/documents, move it through inspection.
5. **Leads** — create walk-in contact, attach a vehicle, assign to a salesperson, change status, schedule a follow-up.
6. **Inbox** — list due notifications and mark them read (admins and salespersons each see their own).
7. **Staff (admin settings)** — create other admins/salespeople. Give salespeople a `showroomId` so their vehicles and leads file there automatically.

The same screens serve salespersons, with assignment, vehicle status, deletes, and staff hidden (see **Roles**). Do **not** start a buyer marketplace or owner self-serve portal. Those APIs are not shipped.

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

Treat `422 VALIDATION_ERROR` as a form error (the API does **not** return field-level details). Other `422` codes are business rules; show the `message`. Treat `409` as a uniqueness conflict (duplicate phone, email, or registration). Treat `403 FORBIDDEN` as a role problem.

### 5. Smoke the same path as Postman

Login → Create Owner → List Makes → List Models → List Variants → Create Vehicle → Create Lead → Associate Vehicle → Assign Lead → Schedule Follow-up → Change Status → List Notifications.

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
| `admin` | Full staff API. Sees every lead. Only role that can assign leads, change vehicle status, delete vehicle media/documents, deactivate owners, or manage staff. |
| `salesperson` | Owners (no deactivate), catalog, vehicle intake (create, edit, photos, documents, status history), leads **assigned to them**, and their own notifications. Leads they create are assigned to them. Other leads answer `404`. |
| `owner` / `buyer` | Seeded in the database. **No HTTP API yet.** |

**Showroom.** A staff member's `showroomId` (set on `/users`) is their home showroom. `POST /vehicles` and `POST /leads` file the record there when the body omits `showroomId`. Only an admin may name a different showroom; a staff member with no home showroom must send one (`422 SHOWROOM_REQUIRED`).

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
| 422 | `INVALID_VEHICLE_STATUS_TRANSITION` | Illegal vehicle status jump (e.g. re-listing a sold vehicle) |
| 422 | `VEHICLE_STATUS_SYSTEM_MANAGED` | `POST /vehicles/:id/status` with `linked` or `sold` (set automatically from leads) |
| 422 | `VEHICLE_HAS_LINKED_LEADS` | Dropping a vehicle with active leads without `confirmUnlinkLeads: true`; `error.details.linkedLeadCount` says how many |
| 422 | `VEHICLE_NOT_LINKABLE` | Linking a lead to a `dropped` or `sold` vehicle |
| 422 | `VEHICLE_ALREADY_SOLD` | Converting a lead whose vehicle was sold through another lead |
| 422 | `SHOWROOM_REQUIRED` | No `showroomId` in the body and no home showroom on your account |
| 422 | `LEAD_CLOSED` | Assigning or attaching a vehicle to a `converted` or `lost` lead |
| 422 | `LEAD_REQUIRES_VEHICLE` | Moving a lead with no vehicle to `booking_confirmed` or `converted` |
| 422 | `LEAD_STATUS_SYSTEM_MANAGED` | Setting `vehicle_unavailable` by hand |
| 422 | `ASSIGNEE_NOT_ELIGIBLE` | `assignedTo` is not an active admin or salesperson |
| 503 | `DB_UNAVAILABLE` / `DB_TRANSIENT` | Database down or retryable |

---

## Endpoint catalogue

**41 routes** are mounted.

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

### Catalog — Admin or Salesperson

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

### Vehicles — Admin or Salesperson (status change and deletes are Admin)

Creates a second-hand car. Status is always `open` on create. Photos and documents use a two-step signed upload (bytes never pass through this API). An admin drops or re-lists a vehicle with a separate POST; `linked` and `sold` follow the vehicle's leads.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/vehicles` | `201` vehicle (`makeName` / `modelName` / `variantName` / `frontImageUrl` are `null` until you GET) |
| `GET` | `/vehicles` | `200` page (includes catalog names and `frontImageUrl`) |
| `GET` | `/vehicles/:id` | `200` vehicle (includes `frontImageUrl`) |
| `PATCH` | `/vehicles/:id` | `200` vehicle (second-hand fields only; cannot change owner/variant/showroom/status) |
| `POST` | `/vehicles/:id/status` | `200` `{ "status", "unlinkedLeadCount" }` (Admin) |
| `GET` | `/vehicles/:id/status-history` | `200` page (newest first) |
| `POST` | `/vehicles/:id/media/uploads` | `200` signed upload ticket |
| `POST` | `/vehicles/:id/media` | `201` media row + short-lived read URL |
| `GET` | `/vehicles/:id/media` | `200` page |
| `DELETE` | `/vehicles/:id/media/:mediaId` | `204` (Admin) |
| `POST` | `/vehicles/:id/documents/uploads` | `200` signed upload ticket |
| `POST` | `/vehicles/:id/documents` | `201` document row + short-lived read URL |
| `GET` | `/vehicles/:id/documents` | `200` page |
| `DELETE` | `/vehicles/:id/documents/:documentId` | `204` (Admin) |

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

`showroomId` is optional: omit it to use your home showroom (see **Roles**).

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
| `status` | `open`, `linked`, `dropped`, `sold` (starts `open`) |

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
  "status": "linked",
  "soldLeadId": null,
  "acquisitionType": "consignment",
  "submittedBy": "uuid",
  "createdAt": "…",
  "updatedAt": "…",
  "frontImageUrl": "https://…",
  "frontImageUrlExpiresAt": "…"
}
```

`frontImageUrl` is a short-lived signed URL (about 10 minutes, see `frontImageUrlExpiresAt`) for the cover photo: the vehicle's `front` photo with the lowest `sortOrder` (earliest upload breaks ties). Both fields are `null` when the vehicle has no front photo. Use it for list thumbnails instead of calling `GET /vehicles/:id/media` per car; refetch the list once it expires. `PATCH /vehicles/:id` returns them as `null`.

**Vehicle lifecycle** (see ADR-0011)

| Status | Meaning |
|--------|---------|
| `open` | In stock with no active lead |
| `linked` | At least one active lead (`new`, `not_now`, `booking_confirmed`) points at it. Many leads can share one vehicle |
| `sold` | A lead converted. `soldLeadId` is that lead |
| `dropped` | Taken out of stock by an admin |

```text
open    → linked (auto: first active lead links) | dropped (admin)
linked  → open (auto: last active lead lost or moved) | sold (auto: a lead converts) | dropped (admin)
dropped → open (admin re-lists)
sold    → (terminal)
```

**Change status (admin):** `{ "status": "dropped" | "open", "reason": null, "confirmUnlinkLeads": false }`

- `linked` / `sold` → `422 VEHICLE_STATUS_SYSTEM_MANAGED`. Same status is a no-op. `PATCH /vehicles/:id` cannot set status.
- Dropping a vehicle that still has active leads first answers `422 VEHICLE_HAS_LINKED_LEADS` with `error.details.linkedLeadCount`. Show the admin that count; on confirm resend with `"confirmUnlinkLeads": true`. Those leads keep their status but lose their `vehicleId`, and the response reports `unlinkedLeadCount`.
- Leads can only link to `open` or `linked` vehicles (`422 VEHICLE_NOT_LINKABLE`).

**Status history item**

```json
{
  "id": "uuid",
  "vehicleId": "uuid",
  "fromStatus": "linked",
  "toStatus": "dropped",
  "changedBy": "uuid",
  "changedByName": "Priya Nair",
  "reason": "owner withdrew",
  "changedAt": "…"
}
```

**Photos and documents**

1. `POST /vehicles/:id/media/uploads` with `{ "category": "front", "contentType": "image/jpeg" }`.
2. `PUT` the bytes to `uploadUrl` using the returned `token` (Supabase signed upload).
3. `POST /vehicles/:id/media` with `{ "storagePath", "category", "sortOrder" }` — `storagePath` must be the one from step 1 and the object must exist.
4. `GET` lists include `url` and `urlExpiresAt` (about 10 minutes). Documents stay `isSensitive: true`.

Documents also accept an optional `"fileName"` on step 3 (`{ "storagePath", "docType", "fileName": "RC_Document.pdf" }`), the name to show in the document list. Any folder part is dropped and it must be 1–255 characters. Document rows return `fileName` (`null` for documents uploaded without one; fall back to `docType`).

Upload ticket:

```json
{
  "storagePath": "<vehicleId>/<uuid>.jpg",
  "uploadUrl": "https://…",
  "token": "…",
  "expiresAt": "…"
}
```

Media `category`: `front`, `rear`, `left`, `right`, `interior`, `dashboard`, `engine`, `tyres`, `other`.  
Media `contentType`: `image/jpeg`, `image/png`, `image/webp` (max 10 MB).  
Document `docType`: `rc`, `insurance`, `service_record`, `loan_clearance`, `inspection_report`, `other`.  
Document `contentType`: `application/pdf`, `image/jpeg`, `image/png` (max 15 MB).

### Leads — Admin or Salesperson (assignment is Admin)

Walk-in contact keyed by phone. Creating a lead with an existing live phone reuses that contact and refreshes name/email.

A salesperson only sees and works leads where `assignedTo` is their id; any other lead id answers `404`. A lead a salesperson creates is assigned to them. An admin's new lead starts unassigned.

| Method | Path | Success |
|--------|------|---------|
| `POST` | `/leads` | `201` lead (`nextFollowUp`, `linkedVehicle` and the `preferred…Name` fields are `null` until you GET) |
| `GET` | `/leads` | `200` page |
| `GET` | `/leads/:id` | `200` lead (includes `nextFollowUp` if scheduled) |
| `PATCH` | `/leads/:id/vehicle` | `200` `{ "vehicleId" }` |
| `PUT` | `/leads/:id/assignment` | `200` `{ "id", "assignedTo" }` (Admin) |
| `PUT` | `/leads/:id/preference` | `200` `{ "preferredMakeId", "preferredModelId", "preferredVariantId" }` |
| `POST` | `/leads/:id/follow-ups` | `201` follow-up |
| `POST` | `/leads/:id/status` | `200` `{ "status", "vehicleMarkedSold" }` |

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
  "preferredMakeId": null,
  "preferredModelId": "<model uuid>",
  "preferredVariantId": null,
  "purchaseTimeline": null,
  "financeRequired": false,
  "currentVehicle": null,
  "tradeInRequired": false,
  "notes": "called the showroom"
}
```

`showroomId` is optional: omit it to use your home showroom (see **Roles**).  
`source`: `marketplace`, `mobile_app`, `website`, `phone`, `walkin`, `whatsapp`, `instagram`, `facebook`, `referral`, `other`.  
**List query:** `limit`, `offset`, optional `status`, `vehicleId`, `assignedTo` (admin only; a salesperson always gets their own leads), `preferredMakeId`, `preferredModelId`, `preferredVariantId`.  
**Preferred catalog:** the buyer's interest as catalog ids from `/catalog/makes`, `/catalog/makes/:id/models` and `/catalog/models/:id/variants` (the same ids as car create). Send only the narrowest pick: a variant alone is enough, and the server fills in its model and make. Any parent you also send must match (`422 PREFERRED_CATALOG_MISMATCH`); an unknown or deleted id is `404`. Because parents are always stored, filtering by `preferredMakeId` also finds leads that picked a model or variant of that make. `preferredVehicle` stays as optional free text and is not derived from the ids.  
**Set preference:** `PUT /leads/:id/preference` with `{ "preferredMakeId", "preferredModelId", "preferredVariantId" }` replaces the whole preference (omitted ids count as `null`; all `null` clears it). Same validation as create; closed leads (`converted`, `lost`) answer `422 LEAD_CLOSED`.  
**Associate vehicle:** `{ "vehicleId": "<uuid>" }` — vehicle must be `open` or `linked`; lead must not be `converted` or `lost`. The new vehicle becomes `linked`; the previous one goes back to `open` if no other active lead remains.  
**Assign:** `{ "assignedTo": "<staff uuid>" }` or `{ "assignedTo": null }` to unassign. The assignee must be an active admin or salesperson. The assignee gets a `lead_assigned` notification (not when you assign yourself), and the change is written to the audit log. Closed leads cannot be reassigned (`422 LEAD_CLOSED`).  
**Schedule follow-up:** `{ "scheduledAt": "2026-10-10T10:00:00.000Z", "taskType": "call", "notes": null }`  
`taskType`: `call`, `whatsapp`, `meeting`, `test_drive`, `send_quotation`, `other`.  
The follow-up belongs to the lead's assignee (or to you if the lead is unassigned), and that person gets a `follow_up_due` notification at `scheduledAt`.  
**Change status:** `{ "status": "not_now", "notes": null }` → `200 { "status", "vehicleSold" }`. Status history records who made the change.  
**Convert (close the sale):** `{ "status": "converted", "notes": null }` from `booking_confirmed`. This always sells the lead's vehicle (`vehicleSold: true`, vehicle `soldLeadId` = this lead) and moves every other active lead on that vehicle to `vehicle_unavailable` with its `vehicleId` cleared. The vehicle and the other leads are updated first; if the request fails part-way, repeat it and it completes.

**Lead object**

```json
{
  "id": "uuid",
  "showroomId": "uuid",
  "vehicleId": "uuid",
  "linkedVehicle": {
    "id": "uuid",
    "makeName": "Hyundai",
    "modelName": "Creta",
    "variantName": "SX",
    "year": 2019,
    "registrationNumber": "KA01AB1234"
  },
  "assignedTo": "uuid or null",
  "contactId": "uuid",
  "contactFullName": "Rahul Sharma",
  "contactPhone": "+919811122233",
  "contactEmail": null,
  "source": "phone",
  "status": "new",
  "budget": 800000,
  "preferredVehicle": null,
  "preferredMakeId": "uuid",
  "preferredMakeName": "Hyundai",
  "preferredModelId": "uuid",
  "preferredModelName": "Creta",
  "preferredVariantId": null,
  "preferredVariantName": null,
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

`linkedVehicle` summarises the vehicle in `vehicleId` for pipeline cards, so you do not need `GET /vehicles/:id` per lead. It is `null` when no vehicle is linked.

New leads start at `new`. Active leads (`new`, `not_now`, `booking_confirmed`) keep their vehicle `linked`. Allowed transitions (anything else → `422 INVALID_LEAD_STATUS_TRANSITION`):

```text
new                 → not_now | booking_confirmed | lost
not_now             → new | booking_confirmed | lost
booking_confirmed   → converted | lost
vehicle_unavailable → new | not_now | booking_confirmed | lost   (link another vehicle first to book)
converted / lost    → (terminal)
```

- `booking_confirmed` and `converted` need a linked vehicle (`422 LEAD_REQUIRES_VEHICLE`).
- `vehicle_unavailable` is set only by the system, when another lead buys this lead's vehicle (`422 LEAD_STATUS_SYSTEM_MANAGED` if sent).
- Losing a lead re-opens its vehicle when no other active lead remains.

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

### Notifications — Admin or Salesperson

Inbox for the **signed-in user**. Items with a future `dueAt` are omitted.

| `type` | `entityType` / `entityId` | Sent to |
|--------|---------------------------|---------|
| `follow_up_due` | `follow_up` / follow-up id | The follow-up's assignee, at `scheduledAt` |
| `lead_assigned` | `lead` / lead id | The new assignee, immediately |

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/notifications` | `200` page |
| `PATCH` | `/notifications/:id/read` | `204` (own notifications only) |

```json
{
  "id": "uuid",
  "type": "follow_up_due",
  "title": "Follow-up due",
  "body": "Follow-up (call) is scheduled",
  "entityType": "follow_up",
  "entityId": "<follow-up uuid>",
  "isRead": false,
  "dueAt": "2026-10-10T10:00:00.000Z",
  "createdAt": "…"
}
```

Poll `GET /notifications` on the home screen. Deep-link `lead` items to the lead. For `follow_up` items, the lead appears in `GET /leads` with that follow-up as `nextFollowUp`.

### Dashboard — Admin only

One call for the home screen: a business snapshot plus today's work list. Salespersons get `403` (admins work every lead today).

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/dashboard?period=month&showroomId=` | `200`, `Cache-Control: private, max-age=30` |

- `period` is one of `today`, `week` (Monday start), `month` or `quarter`, and defaults to `month`. Any other value returns `422 VALIDATION_ERROR`.
- `showroomId` is optional. Leave it out to cover all showrooms.

```json
{
  "generatedAt": "2026-10-05T09:30:00.000Z",
  "period": { "key": "month", "from": "2026-10-01", "to": "2026-10-31", "timezone": "Asia/Kolkata" },
  "kpis": {
    "carsSold":       { "value": 7,    "previous": 5 },
    "newLeads":       { "value": 42,   "previous": 38 },
    "conversionRate": { "value": 0.18, "previous": 0.13 },
    "inStock":        { "value": 31 }
  },
  "attention": {
    "overdueFollowUps":     { "total": 6, "items": [ /* FollowUpCard */ ] },
    "leadsWithoutFollowUp": { "total": 4, "items": [ /* LeadCard */ ] },
    "agedStock":            { "total": 5, "items": [ /* VehicleCard */ ] }
  },
  "today": { "total": 5, "items": [ /* FollowUpCard */ ] },
  "pipeline":  { "new": 12, "not_now": 9, "booking_confirmed": 4 },
  "inventory": { "open": 19, "linked": 12 }
}
```

Each list holds at most 5 rows, oldest or most urgent first. `total` is the full count, so link "see all" to `GET /leads` or `GET /vehicles`.

| Card | Fields |
|------|--------|
| FollowUpCard | `followUpId`, `leadId`, `taskType`, `scheduledAt`, `contactName`, `contactPhone`, `vehicleLabel` |
| LeadCard | `leadId`, `status`, `source`, `contactName`, `contactPhone`, `vehicleLabel`, `createdAt` |
| VehicleCard | `vehicleId`, `vehicleLabel`, `status`, `daysListed`, `activeLeads` |

`vehicleLabel` reads like `"2019 Maruti Swift VXi · KA01AB1234"`. It is `null` when the lead has no vehicle.

**How each number is counted**

- **Day and period boundaries** use the business timezone (`BUSINESS_TIMEZONE`, default `Asia/Kolkata`).
- **Period KPIs are period to date.** `previous` covers the same elapsed span of the previous period, so Oct 1–5 is compared with Sep 1–5.
- **Follow-ups are counted per active lead.** Each active lead is judged by its **latest** open follow-up, so scheduling a new follow-up replaces the old one. Follow-ups on closed leads are ignored.

| Field | Meaning |
|-------|---------|
| `carsSold` | Vehicles moved to `sold` in the period |
| `newLeads` | Leads created in the period |
| `conversionRate` | converted ÷ (converted + lost), counting leads closed in the period. `null` when none closed |
| `inStock` | Listed vehicles (`open` + `linked`) right now |
| `attention.overdueFollowUps` | Active leads whose current follow-up is in the past |
| `attention.leadsWithoutFollowUp` | Active leads with no open follow-up |
| `attention.agedStock` | Listed vehicles added more than 45 days ago |
| `today` | Active leads whose current follow-up is due between now and midnight |
| `pipeline` | Active leads by status, right now |
| `inventory` | Listed vehicles by status, right now |

Revenue, profit and average selling price arrive with finance (Stint 5).

---

## Suggested admin UI map

| Screen | Endpoints |
|--------|-----------|
| Login | `POST /auth/login`, then `GET /auth/me` |
| App shell | `GET /auth/me` for name + roles; `GET /notifications` badge |
| Home (admin) | `GET /dashboard?period=` |
| Owners list / form | `GET/POST/PATCH /owners`, `GET /owners/:id` |
| Vehicle create | `GET /catalog/makes` → models → variants, then `POST /vehicles` |
| Vehicle list / detail | `GET /vehicles`, `GET /vehicles/:id`, `PATCH /vehicles/:id`, `POST /vehicles/:id/status`, `GET /vehicles/:id/status-history` |
| Vehicle photos / docs | signed upload then `POST /vehicles/:id/media` or `/documents` |
| Lead pipeline | `GET /leads?status=&assignedTo=`, `POST /leads`, `PATCH /leads/:id/vehicle`, `PUT /leads/:id/assignment`, `POST /leads/:id/status`, `POST /leads/:id/follow-ups` |
| Inbox | `GET /notifications`, `PATCH /notifications/:id/read` |
| Staff settings | `/users` (admin only) |

For `salesperson`, show owners, catalog, vehicles, leads, and the inbox, and hide the dashboard, staff settings, lead assignment, vehicle status buttons, media/document delete, and owner deactivate. Show everything for `admin`.

---

## Not shipped yet — do not design screens against these

- Owner self-registration / portal (`owners.userId` linking)
- Acquisition prices / finance / profit (`vehicle_financials`)
- Marketplace / buyer browse and buyer inquiries (registered-buyer leads)
- Automatic lead assignment
- Password reset or change-own-password

Those stay on the backend roadmap (`docs/MVP_ROADMAP.md`). If you need a contract for a later screen, wait until the matching folder appears in this file and in Postman.
