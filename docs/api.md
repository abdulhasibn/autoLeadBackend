# AutoLead API — frontend guide

What is live today, and how a frontend (admin web first) can start against it.

**Current phase:** staff (admin + salesperson) vehicle intake, inspection, inventory listing statuses, and walk-in lead management with assignment. The customer website reads Listed stock and files test-drive requests through the anonymous `/public` routes. There is no buyer login or owner portal yet.

**Base URL:** `http://localhost:3000`  
**Production:** `https://autolead-backend-lyart.vercel.app` (deploys from `main`)  
**Postman:** `postman/` in this repo, mirrored at [autoLeadBackend-postman](https://github.com/abdulhasibn/autoLeadBackend-postman) (also **AutoLead API** + **AutoLead Local** in Postman *My Workspace*)

---

## How frontend apps should start

### 1. Point at the local API

Staff routes allow any browser origin (`cors()` with defaults). `/public` routes allow only the origins in `PUBLIC_SITE_ORIGINS`. Start the API with `pnpm dev` on port `3000`.

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
```

Use JSON only. Send `Content-Type: application/json` on bodies.

### 2. Sign in as the bootstrap admin

The hosted project is seeded by `scripts/seed-test-data.ts` (`pnpm seed:test-data`) with:

| Field | Value |
|-------|-------|
| Email | `admin@example.com` |
| Password | `secret12` |
| Role | `admin` |
| Seeded showroom | `b0000000-0000-4000-8000-000000000001` |

Other seeded logins (all with password `secret12`): `kavita.iyer@example.com` (admin + salesperson), `rohan.verma@example.com`, `sneha.kulkarni@example.com`, `priya.raman@example.com`, `deepa.hegde@example.com`, `vikram.joshi@example.com` (salespeople). `imran.shaikh@example.com` is a deactivated salesperson.

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

**Sign out:** call `POST /auth/logout`, then clear both tokens locally, even if the call fails. **Change password:** after `204`, keep the current tokens; every other device is signed out. **Forgot password:** `POST /auth/forgot-password` emails a 6-digit code, then `POST /auth/reset-password` sets the new password. After `204`, send the user to login: every session was ended.

**Finance (encrypted, admin only).** Finance needs its own key on top of the login. On a database filled by `pnpm seed:test-data`, the seeder prints the finance key and recovery key at the end (and the registration of the car that holds the client's worked example). On any other database, the first admin runs **Finance › Vault › Setup** and keeps the two keys it shows once. See [Finance](#finance--admin-only-encrypted-adr-0014).

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
| Search | Optional `search` on `GET /owners`, `/leads`, `/vehicles`: case-insensitive partial match, applied before paging (so `total` counts matches). 1–100 characters; `% _ * \ , ( ) "` are ignored; blank means no search |
| Multi-value filters | Comma-separated, e.g. `?fuelType=petrol,diesel` |
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
| `salesperson` | Owners (no deactivate), catalog, showrooms, vehicle intake (create, edit, photos, documents, status history), leads **assigned to them**, their own dashboard, and their own notifications. Leads they create are assigned to them. Other leads answer `404`. |
| `owner` / `buyer` | Seeded in the database. **No HTTP API yet.** |

**Showroom.** A staff member's `showroomId` (set on `/users`, returned on `GET /auth/me`) is their home showroom. `GET /showrooms` lists the showrooms for pickers. `POST /vehicles` and `POST /leads` file the record there when the body omits `showroomId`. Only an admin may name a different showroom; a staff member with no home showroom must send one (`422 SHOWROOM_REQUIRED`).

### HTTP error codes

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_JSON` | Body is not valid JSON (the body is never logged) |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 1 MB |
| 401 | `AUTHENTICATION_FAILED` | Missing/invalid/expired bearer |
| 401 | `INVALID_CREDENTIALS` | Bad email/password or refresh token |
| 422 | `INVALID_CURRENT_PASSWORD` | `POST /auth/change-password` with the wrong current password (deliberately not 401, so it doesn't trigger a refresh) |
| 422 | `PASSWORD_UNCHANGED` | New password equals the current one |
| 422 | `WEAK_PASSWORD` | Supabase rejected the new password as too weak |
| 422 | `INVALID_RESET_CODE` | Wrong or expired reset code (codes last 15 minutes and work once) |
| 429 | `RATE_LIMITED` | Supabase Auth throttled the request; wait a minute |
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
| 422 | `LEAD_CLOSED` | Editing, assigning, or attaching/removing a vehicle on a `converted` or `lost` lead |
| 422 | `LEAD_REQUIRES_VEHICLE` | Moving a lead with no vehicle to `booking_confirmed` or `converted`, or removing the vehicle of a `booking_confirmed` lead |
| 422 | `LEAD_STATUS_SYSTEM_MANAGED` | Setting `vehicle_unavailable` by hand |
| 422 | `ASSIGNEE_NOT_ELIGIBLE` | `assignedTo` is not an active admin or salesperson |
| 409 | `FINANCE_NOT_INITIALIZED` | Finance used before `POST /finance/vault/setup` |
| 409 | `FINANCE_ALREADY_INITIALIZED` | Setting up or confirming a vault that is already confirmed |
| 409 | `FINANCE_VAULT_NOT_CONFIRMED` | Unlocking, changing the key or recovering before the recovery key was confirmed |
| 422 | `INVALID_FINANCE_KEY` | Well-formed finance or recovery key that doesn't open the vault (counts toward the lockout) |
| 423 | `FINANCE_LOCKED` | Finance route without a valid `X-Finance-Session` (missing, expired, locked, or another user's): show the unlock screen |
| 429 | `FINANCE_UNLOCK_BLOCKED` | Five wrong keys within 15 minutes; key entry is paused for 15 minutes |
| 409 | `FINANCE_TAG_NAME_TAKEN` | Another tag (archived or not) already has that name, ignoring case |
| 422 | `FINANCE_TAG_NOT_FOUND` / `FINANCE_TAG_ARCHIVED` | An entry names an unknown tag, or adds an archived one (`error.details.tagId`) |
| 422 | `INVALID_ENTRY_PURPOSE` | Purpose doesn't fit the entry (see Finance › Entries) |
| 422 | `ENTRY_SHOWROOM_FOLLOWS_VEHICLE` | A car-linked entry given a showroom other than the car's |
| 422 | `INVALID_AMOUNT` / `TOO_MANY_TAGS` / `TEXT_TOO_LONG` | Amount not above zero; more than 10 tags; party over 120 or note over 1000 characters |
| 422 | `DATE_RANGE_REQUIRED` / `DATE_RANGE_TOO_LONG` / `INVALID_DATE_RANGE` | `GET /finance/entries` without `from`+`to` (and no `vehicleId`), over 366 days, or `to` before `from` |
| 503 | `DB_UNAVAILABLE` / `DB_TRANSIENT` | Database down or retryable |

---

## Endpoint catalogue

**98 routes** are mounted (including `/health`).

### Health — public

| Method | Path | Auth | Success |
|--------|------|------|---------|
| `GET` | `/health` | Public | `200` `{ status: "ok", timestamp }` |

Use this as the frontend “API is up” check.

### Public marketplace — no auth (customer website, ADR-0010)

Anonymous. CORS is limited to `PUBLIC_SITE_ORIGINS`. Only Listed vehicles (`open` / `linked`, not deleted) are visible, and only through `public_vehicle_list`: no plate, owner, documents, RC/loan state, internal prices or lead counts. Unknown, sold and dropped ids all answer `404`.

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/public/vehicles` | `200` page of summaries. Query: `makeId`, `modelId`, `bodyType`, `fuelType`, `transmission` (CSV), `priceMin`, `priceMax`, `yearMin`, `kmMax`, `sort` (`newest` \| `price_asc` \| `price_desc` \| `km_asc`), `limit` (≤ 48, default 24), `offset` |
| `GET` | `/public/vehicles/:id` | `200` detail: summary + `description` + `photos[]` (`{ url, category }`, in display order) |
| `GET` | `/public/filters` | `200` `{ makes[{ id, name, models[] }], bodyTypes, fuelTypes, transmissions, priceRange, yearRange }` built from current stock |
| `POST` | `/public/test-drive-requests` | `201` new lead, `200` repeat on an active lead → `{ outcome, vehicleAvailable, showroom }` |
| `POST` | `/public/events` | `204` always. Website analytics beacon (ADR-0016), see below |

Summary fields: `id, make, model, variant, bodyType, year, fuelType, transmission, kmDriven, previousOwners, colour, listedPrice` (rupees or `null` → show "Price on request"), `coverImageUrl`. Photo URLs are signed for 24 hours; GET responses carry `Cache-Control: s-maxage=300`.

All `/public` responses send `Cross-Origin-Resource-Policy: cross-origin` (staff routes keep helmet's `same-origin`).

Test-drive body: `{ vehicleId, fullName, phone, fax?, attribution? }`. The phone is an Indian mobile in any common shape (`98765 43210`, `+91…`, `0…`), stored as E.164. `fax` is a honeypot: leave the hidden input empty; any value gets a fake `201` and nothing is recorded. Body limit 10 KB.

- Creates a `website` lead, unassigned, in the vehicle's showroom, attributed to the **Website** system user, and notifies every admin (`website_lead`). The vehicle flips `open` → `linked`.
- An existing contact with that phone is reused and **never renamed**; a different name is kept in the lead notes.
- An active lead for the same phone + vehicle gets a note appended instead of a duplicate (`200`, `outcome: "updated"`); its assignee (or every admin) is notified.
- If the car sold meanwhile, the lead is still created without the vehicle and `vehicleAvailable` is `false`.
- `showroom` (`name, address, city, phone, openingHours, googleMapsUrl`) is returned **only here**; no public GET exposes the address.
- Rate limits: 5 requests per IP per hour, and 3 per phone + vehicle per day → `429 RATE_LIMITED`. Invalid phone → `422 INVALID_PHONE`.
- `attribution` (optional; older clients omit it): `{ visitorId, sessionId, firstTouch, lastTouch }` (uuids + touches as below). The server classifies each touch. On a **new** lead it stores `lead_attribution`, and a Meta last touch (`instagram_ads`, `instagram_organic`, `facebook_ads`, `facebook_organic`) makes the lead source `instagram` / `facebook` instead of `website`. A repeat request stores nothing new.

**Analytics events** (`POST /public/events`). The site posts JSON with `Content-Type: text/plain` through `navigator.sendBeacon` (no CORS preflight); `application/json` works too. Body limit 16 KB.

```ts
{
  visitorId: uuid, sessionId: uuid,
  touch: {                                   // the session's landing touch, raw
    utmSource?, utmMedium?, utmCampaign?, utmContent?, utmTerm?: string (≤ 120),
    hasFbclid: boolean, hasGclid: boolean,
    referrer?: string (≤ 300, origin only), landingPath: string (≤ 300),
    inAppBrowser: "instagram" | "facebook" | null
  },
  events: [{                                 // 1..20
    type: "page_view" | "car_view" | "gallery_open" | "filter_apply" | "test_drive_open"
        | "whatsapp_click" | "call_click" | "directions_click",
    at: ISO time, path: string (≤ 300), vehicleId?: uuid,
    props?: { [key]: string | number | boolean | null }   // ≤ 12 keys
  }]
}
```

- Always `204`, even for invalid or oversized bodies: nothing is reported back. Bot and blank user agents are dropped.
- The channel is classified server-side: `instagram_ads | instagram_organic | facebook_ads | facebook_organic | google_ads | google_organic | whatsapp | direct | referral | other`. UTM tags win (`utm_medium` containing `paid`, or `cpc`/`ppc`/`cpm`/`display` → ads); without them a `gclid` → `google_ads`, then the in-app browser or referrer names the network; nothing at all → `direct`.
- A session keeps the touch of its first batch. At most 500 events per session per hour are stored; event times are clamped to the last 24 hours. Events are kept 13 months.

### Auth

| Method | Path | Auth | Success |
|--------|------|------|---------|
| `POST` | `/auth/login` | Public | `200` `{ accessToken, refreshToken }` |
| `POST` | `/auth/refresh` | Public | `200` `{ accessToken, refreshToken }` (old refresh token is rotated) |
| `GET` | `/auth/me` | Bearer | `200` profile |
| `POST` | `/auth/logout` | Bearer | `204`. Ends this session (`scope: "local"`, the default) or every session (`"global"`); their refresh tokens stop working |
| `POST` | `/auth/change-password` | Bearer | `204`. Other sessions end; this one stays signed in |
| `POST` | `/auth/forgot-password` | Public | `202` `{ message }`. Same answer whether or not the account exists |
| `POST` | `/auth/reset-password` | Public | `204`. Every session ends; sign in again |

**Login / refresh body**

```json
{ "email": "admin@example.com", "password": "secret12" }
```

```json
{ "refreshToken": "<refreshToken>" }
```

**Logout body** (optional; an empty body signs out this device only)

```json
{ "scope": "local" }
```

**Change password body.** `newPassword` needs at least 8 characters and must differ from the current password.

```json
{ "currentPassword": "secret12", "newPassword": "new-secret-34" }
```

**Forgot / reset password bodies.** The email carries a 6-digit `code` that is valid for 15 minutes. Requesting a new code replaces the old one, and the same address can request at most one code per minute.

```json
{ "email": "admin@example.com" }
```

```json
{ "email": "admin@example.com", "code": "123456", "newPassword": "new-secret-34" }
```

**Me**

```json
{
  "id": "uuid",
  "fullName": "Admin",
  "phone": "+9198…",
  "email": "admin@example.com",
  "avatarUrl": null,
  "roles": ["admin"],
  "showroomId": "uuid or null"
}
```

`showroomId` is the signed-in user's home showroom (`null` if they have none).

### Showrooms — Admin or Salesperson

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/showrooms` | `200` page of `{ id, name, city }`, active showrooms only, by name |

Use it for showroom pickers (admin record create, staff home showroom). Pagination: `limit`, `offset`.

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
**List query:** `limit`, `offset`, optional `city` (exact), `phone` (E.164, exact), `search` (partial match on name, phone or city).

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
| `GET` | `/vehicles` | `200` page (includes catalog names, `frontImageUrl` and `linkedLeadCount`) |
| `GET` | `/vehicles/:id` | `200` vehicle (includes `frontImageUrl` and `linkedLeadCount`) |
| `PATCH` | `/vehicles/:id` | `200` vehicle (second-hand fields only; cannot change owner/variant/showroom/status) |
| `PUT` | `/vehicles/:id/listed-price` | `200` `{ listedPrice }`: body `{ "listedPrice": 1250000 \| null }` in whole rupees (Admin). The public asking price; vehicles return it as `listedPrice` |
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

**List query** (all optional, AND-combined): `limit`, `offset`, `status`, `ownerId`, `showroomId`, `registration` (exact), plus:

| Param | Meaning |
|-------|---------|
| `search` | Every word must partially match the registration or the make, model or variant name (`creta ka01`) |
| `makeId` / `modelId` / `variantId` | Catalog ids from `/catalog/...`. Combine freely; a mismatched pair just returns nothing |
| `yearMin` / `yearMax` | Inclusive model-year range (`1900–2100`) |
| `kmMin` / `kmMax` | Inclusive `kmDriven` range |
| `priceMin` / `priceMax` | Inclusive `listedPrice` range in whole rupees; cars without a listed price drop out. A min above its max is `422` |
| `fuelType` | One or more fuel types, comma-separated |
| `transmission` | One or more transmissions, comma-separated |

A min above its max is `422 VALIDATION_ERROR`. Price filters arrive with acquisition prices (`vehicle_financials`).

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
  "frontImageUrlExpiresAt": "…",
  "linkedLeadCount": 2
}
```

`linkedLeadCount` is the number of active leads (`new`, `not_now`, `booking_confirmed`) whose `vehicleId` is this vehicle: `0` when none, including `open` / `dropped` / `sold` vehicles. `POST` / `PATCH /vehicles` return `0`.

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
| `PATCH` | `/leads/:id` | `200` lead (edit CRM fields; embeds and names are `null` until you GET) |
| `PATCH` | `/leads/:id/vehicle` | `200` `{ "vehicleId" }` |
| `DELETE` | `/leads/:id/vehicle` | `200` `{ "vehicleId": null }` |
| `PUT` | `/leads/:id/assignment` | `200` `{ "id", "assignedTo" }` (Admin) |
| `PUT` | `/leads/:id/preference` | `200` the whole preference (`preferredMakeId` … `preferredMaxOwners`) |
| `GET` | `/leads/vehicle-matches/:vehicleId` | `200` `{ vehicle, linked, suggested, truncated }`: match % per lead |
| `GET` | `/leads/:id/vehicle-matches` | `200` `{ linked, suggested, truncated }`: match % per car |
| `GET` | `/leads/:id/follow-ups` | `200` page of follow-ups (`?status=open\|closed\|all`) |
| `POST` | `/leads/:id/follow-ups` | `201` follow-up |
| `POST` | `/leads/:id/follow-ups/:followUpId/complete` | `200` `{ "followUp", "next" }` |
| `POST` | `/leads/:id/follow-ups/:followUpId/cancel` | `200` follow-up |
| `POST` | `/leads/:id/status` | `200` `{ "status", "vehicleSold" }` |
| `GET` | `/leads/:id/status-history` | `200` page (newest first) |

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
  "preferredColours": ["white", "silver"],
  "preferredFuelTypes": ["petrol", "cng"],
  "preferredTransmissions": [],
  "preferredBodyTypes": ["hatchback"],
  "preferredYearMin": 2018,
  "preferredYearMax": null,
  "preferredKmMax": 60000,
  "preferredMaxOwners": 1,
  "purchaseTimeline": null,
  "financeRequired": false,
  "currentVehicle": null,
  "tradeInRequired": false,
  "notes": "called the showroom"
}
```

`showroomId` is optional: omit it to use your home showroom (see **Roles**).  
`source`: `marketplace`, `mobile_app`, `website`, `phone`, `walkin`, `whatsapp`, `instagram`, `facebook`, `referral`, `other`.  
**List query** (all optional, AND-combined): `limit`, `offset`, `status`, `vehicleId`, `assignedTo` (admin only; a salesperson always gets their own leads), `preferredMakeId`, `preferredModelId`, `preferredVariantId`, `linkedMakeId` / `linkedModelId` / `linkedVariantId` (the make, model or variant of the car linked to the lead; leads with no car, or another car, drop out), plus `search` (partial match on contact name or phone), `budgetMin` / `budgetMax` (inclusive, whole rupees like `budget`; leads with no budget drop out), `source` (one or more, comma-separated), `hasVehicle` (`true` / `false`), `purchaseTimeline` (exact text), `financeRequired` (`true` / `false`), `createdFrom` (inclusive) / `createdTo` (exclusive) as ISO date or datetime. A min above its max is `422 VALIDATION_ERROR`.  
**Preferred catalog:** the buyer's interest as catalog ids from `/catalog/makes`, `/catalog/makes/:id/models` and `/catalog/models/:id/variants` (the same ids as car create). Send only the narrowest pick: a variant alone is enough, and the server fills in its model and make. Any parent you also send must match (`422 PREFERRED_CATALOG_MISMATCH`); an unknown or deleted id is `404`. Because parents are always stored, filtering by `preferredMakeId` also finds leads that picked a model or variant of that make. `preferredVehicle` stays as optional free text and is not derived from the ids.  
**Preference profile** (all optional, on create and `PUT /leads/:id/preference`; the same terms a car is recorded in):

| Field | Type | Meaning / rules |
|-------|------|-----------------|
| `budget` | number | The buyer's **price ceiling** in rupees (not a separate field; it is the lead's `budget`) |
| `preferredMakeId` / `ModelId` / `VariantId` | uuid | Catalog interest (above) |
| `preferredColours` | string[] | Free text, stored lower-cased and trimmed, max 20. `"white"` matches a car whose colour is `"Pearl White"` (whole words) |
| `preferredFuelTypes` | string[] | `petrol`, `diesel`, `cng`, `electric`, `hybrid` |
| `preferredTransmissions` | string[] | `manual`, `automatic`, `amt`, `cvt`, `dct` |
| `preferredBodyTypes` | string[] | `hatchback`, `sedan`, `suv`, `muv`, `mpv`, `crossover`, `coupe`, `convertible`, `sports`, `pick-up` (from the variant's catalog body type) |
| `preferredYearMin` / `preferredYearMax` | int | Model-year window, 1950–2100; either side may be `null`; min ≤ max |
| `preferredKmMax` | int | Highest odometer reading, ≥ 0 |
| `preferredMaxOwners` | int | Most previous owners, ≥ 0 |

Omitted lists come back as `[]` and omitted numbers as `null`; empty means "any". Invalid values answer `422 VALIDATION_ERROR`.  
**Set preference:** `PUT /leads/:id/preference` with the catalog ids and the profile fields above replaces the **whole** preference: anything you omit is cleared, so send the full form every time. An empty body clears it. Same validation as create; closed leads (`converted`, `lost`) answer `422 LEAD_CLOSED`. The budget is edited with `PATCH /leads/:id`.  
**Vehicle lead matches:** `GET /leads/vehicle-matches/:vehicleId?minScore=60&limit=10` scores leads against one car. Use it on the car detail screen.
- `linked`: every lead linked to the car (any status), best match first; leads with no preference have `match: null` and come last.
- `suggested`: open leads (`new`, `not_now`, `vehicle_unavailable`) with no vehicle, in the car's showroom, scoring at least `minScore` (0–100, default 60) on at least two criteria. Best first, at most `limit` (1–50, default 10). Link one with `PATCH /leads/:id/vehicle`.
- A salesperson only gets leads assigned to them. Unknown or deleted car → `404`.
- `truncated: true` means only the newest 1000 open leads were scored for suggestions.

Each lead is the usual lead object plus `match`:

```json
{
  "vehicle": { "id": "uuid", "showroomId": "uuid", "status": "open", "makeId": "uuid", "makeName": "Hyundai", "modelId": "uuid", "modelName": "i20", "variantId": "uuid", "variantName": "Asta", "year": 2019, "registrationNumber": "KA01AB1234", "kmDriven": 42000, "colour": "Pearl White", "fuelType": "petrol", "transmission": "manual", "bodyTypes": ["hatchback"], "numPreviousOwners": 1, "listedPrice": 620000 },
  "linked": [{ "id": "uuid", "contactFullName": "Rahul Sharma", "…": "…", "match": {
    "score": 87,
    "evaluatedCriteria": 4,
    "breakdown": [
      { "criterion": "catalog", "weight": 30, "earned": 30, "outcome": "match" },
      { "criterion": "budget", "weight": 25, "earned": 19.44, "outcome": "partial" },
      { "criterion": "fuelType", "weight": 7, "earned": 7, "outcome": "match" },
      { "criterion": "colour", "weight": 3, "earned": 0, "outcome": "miss" }
    ]
  } }],
  "suggested": [],
  "truncated": false
}
```

**Lead vehicle matches:** `GET /leads/:id/vehicle-matches?minScore=60&limit=10` is the same score the other way round: cars for one lead. Use it on the lead detail screen.
- `linked`: `{ vehicle, match }` for the lead's own car, or `null` when it has none.
- `suggested`: `{ vehicle, match }[]`. These are live cars in the lead's showroom with status `open` or `linked` (a car can carry several leads), not counting the lead's own car. Each scores at least `minScore` on at least two criteria. Best first, at most `limit`. Link one with `PATCH /leads/:id/vehicle`.
- A lead with no preference and no budget gets `match: null` on `linked` and an empty `suggested`.
- A salesperson can only ask about leads assigned to them; anyone else's lead, or an unknown one, answers `404`.
- `truncated: true` means only the newest 1000 cars were scored.

`vehicle` and `match` have the shapes shown above:

```json
{
  "linked": null,
  "suggested": [{ "vehicle": { "id": "uuid", "makeName": "Hyundai", "modelName": "i20", "…": "…", "listedPrice": 620000 }, "match": { "score": 87, "evaluatedCriteria": 4, "breakdown": ["…"] } }],
  "truncated": false
}
```

**How the score works:** each criterion the lead filled in has a weight. The score is points earned ÷ weight of the criteria evaluated × 100, rounded. Criteria left blank are skipped. Budget is skipped (`outcome: "unknown"`) while the car has no listed price; body type is skipped when the catalog has none.

| Criterion | Weight | Full credit | Partial credit |
|-----------|--------|-------------|----------------|
| `catalog` | 30 | Same variant (or model / make, if that is the narrowest pick) | Wanted variant: same model 20, same make 8. Wanted model: same make 10 |
| `budget` | 25 | `listedPrice` ≤ `budget` | Linear down to 0 at 15 % over budget |
| `year` | 10 | Inside the window | −⅓ per year outside; 0 at 3 years |
| `km` | 10 | `kmDriven` ≤ `preferredKmMax` | Linear down to 0 at 25 % over |
| `fuelType` | 7 | In the list | — |
| `transmission` | 7 | In the list | — |
| `bodyType` | 4 | Any shared body type | — |
| `previousOwners` | 4 | ≤ `preferredMaxOwners` | Half at one owner over |
| `colour` | 3 | A preferred colour is a word of the car's colour | — |

`outcome` is `match` (full), `partial`, `miss` (0), or `unknown` (skipped).  
**Edit lead:** `PATCH /leads/:id` replaces the CRM fields: `{ "fullName", "phone", "email", "source", "budget", "purchaseTimeline", "financeRequired", "currentVehicle", "tradeInRequired", "notes" }`. `fullName`, `phone` and `source` are required; any optional field you leave out is cleared. Contacts are keyed by phone: keeping the phone updates that contact's name/email (on every lead that shares it); a new phone moves the lead to the contact with that phone, creating one if needed. Status, vehicle, assignment and preference keep their own endpoints. Closed leads answer `422 LEAD_CLOSED`.  
**Associate vehicle:** `{ "vehicleId": "<uuid>" }` — vehicle must be `open` or `linked`; lead must not be `converted` or `lost`. The new vehicle becomes `linked`; the previous one goes back to `open` if no other active lead remains.  
**Remove vehicle:** `DELETE /leads/:id/vehicle` clears the link without closing the lead. The vehicle goes back to `open` if no other active lead remains. Closed leads answer `422 LEAD_CLOSED`; a `booking_confirmed` lead must keep its vehicle (`422 LEAD_REQUIRES_VEHICLE`), so change its status first. A lead with no vehicle answers `200` unchanged.  
**Assign:** `{ "assignedTo": "<staff uuid>" }` or `{ "assignedTo": null }` to unassign. The assignee must be an active admin or salesperson. The assignee gets a `lead_assigned` notification (not when you assign yourself), and the change is written to the audit log. Closed leads cannot be reassigned (`422 LEAD_CLOSED`).  
**Schedule follow-up:** `{ "scheduledAt": "2026-10-10T10:00:00.000Z", "taskType": "call", "notes": null }`  
`taskType`: `call`, `whatsapp`, `meeting`, `test_drive`, `send_quotation`, `other`.  
The follow-up belongs to the lead's assignee (or to you if the lead is unassigned), and that person gets a `follow_up_due` notification at `scheduledAt`.  
**List follow-ups:** `GET /leads/:id/follow-ups?status=open|closed|all&limit=&offset=` (default `all`). `open` is the to-do list, earliest first; `closed` is completed and cancelled ones, most recently closed first; `all` is newest `scheduledAt` first. Items: `{ "id", "leadId", "taskType", "scheduledAt", "notes", "status" (open | completed | cancelled), "outcome", "completionNotes", "completedAt", "completedBy", "completedByName", "cancelledAt", "cancelledBy", "cancelledByName", "assignedTo", "assignedToName", "createdBy", "createdByName", "createdAt" }`. Same visibility as `GET /leads/:id`.  
**Complete follow-up:** `{ "outcome": "no_answer", "notes": null, "next": { "scheduledAt", "taskType", "notes" } }`. `outcome`: `reached`, `no_answer`, `rescheduled`, `not_interested`, `done`. `next` is optional; when given, the next follow-up (and its reminder) is scheduled in the same transaction, exactly like `POST /leads/:id/follow-ups`. Returns `{ "followUp", "next" }` (`next` is `null` when not requested). The follow-up's `follow_up_due` notification is marked read.  
**Cancel follow-up:** no body. The follow-up is soft-deleted and its notification marked read.  
Closing a follow-up that is already completed or cancelled answers `422 FOLLOW_UP_CLOSED` (or `409 CONFLICT` if another request closed it at the same moment). A follow-up id from another lead answers `404`. Completing and cancelling work on closed leads too, so stale items can be cleared.  
**Change status:** `{ "status": "not_now", "notes": null }` → `200 { "status", "vehicleSold" }`. Status history records who made the change.  
**Status history:** `GET /leads/:id/status-history?limit=&offset=` → page of `{ "id", "leadId", "fromStatus", "toStatus", "changedBy", "changedByName", "notes", "changedAt" }`, newest first. `fromStatus` is `null` on the first (create) entry; `notes` is `null` when none were given. Same visibility as `GET /leads/:id`.  
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
  "assignedToName": "Priya Nair",
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
  "preferredColours": ["white"],
  "preferredFuelTypes": ["petrol"],
  "preferredTransmissions": [],
  "preferredBodyTypes": [],
  "preferredYearMin": 2018,
  "preferredYearMax": null,
  "preferredKmMax": 60000,
  "preferredMaxOwners": null,
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

`linkedVehicle` summarises the vehicle in `vehicleId` for pipeline cards, so you do not need `GET /vehicles/:id` per lead. It is `null` when no vehicle is linked. `assignedToName` is the assignee's full name (`null` when unassigned).

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
  "dueAt": "2026-10-10T10:00:00.000Z",
  "status": "open",
  "outcome": null,
  "completionNotes": null,
  "completedAt": null,
  "cancelledAt": null
}
```

Complete and cancel return the same shape with `status` `completed` / `cancelled` filled in. `notificationId` and `dueAt` are `null` for a follow-up stored without a due reminder (for example, imported or seeded data).

### Notifications — Admin or Salesperson

Inbox for the **signed-in user**. Items with a future `dueAt` are omitted.

| `type` | `entityType` / `entityId` | Sent to |
|--------|---------------------------|---------|
| `follow_up_due` | `follow_up` / follow-up id | The follow-up's assignee, at `scheduledAt` |
| `lead_assigned` | `lead` / lead id | The new assignee, immediately |

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/notifications?isRead=` | `200` page + `unreadCount` |
| `PATCH` | `/notifications/:id/read` | `204` (own notifications only) |

```json
{
  "id": "uuid",
  "type": "follow_up_due",
  "title": "Follow-up due",
  "body": "Follow-up (call) is scheduled",
  "entityType": "follow_up",
  "entityId": "<follow-up uuid>",
  "leadId": "<lead uuid>",
  "isRead": false,
  "dueAt": "2026-10-10T10:00:00.000Z",
  "createdAt": "…"
}
```

The page also carries `"unreadCount"`: unread due notifications for you, whatever `isRead`, `limit` or `offset` you sent. Use it for the bell badge. `isRead=false` (or `true`) filters the items, and `total` then counts only those.

`leadId` is the lead the notification is about, for both `follow_up_due` and `lead_assigned`, so a tap can open `GET /leads/:id` directly.

Poll `GET /notifications` on the home screen.

### Dashboard — Admin or Salesperson

One call for the home screen: a business snapshot plus today's work list.

- **Admin** (`"scope": "all"`): every lead and vehicle in the chosen showroom, or all showrooms.
- **Salesperson** (`"scope": "mine"`): only leads assigned to them. That covers new leads, conversion, follow-ups, the pipeline, and cars sold through their leads. Showroom-wide stock is left out: `kpis.inStock`, `attention.agedStock` and `inventory` are `null`, and `showroomId` is ignored.

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/dashboard?period=month&showroomId=` | `200`, `Cache-Control: private, max-age=30` |

- `period` is one of `today`, `week` (Monday start), `month` or `quarter`, and defaults to `month`. Any other value returns `422 VALIDATION_ERROR`.
- `showroomId` is optional (admin only). Leave it out to cover all showrooms.

```json
{
  "generatedAt": "2026-10-05T09:30:00.000Z",
  "scope": "all",
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
- **Follow-ups are counted per active lead.** Each active lead is judged by its **earliest** open follow-up (the same one `GET /leads/:id` returns as `nextFollowUp`). An overdue follow-up stays overdue until it is completed or cancelled. Follow-ups on closed leads are ignored.

| Field | Meaning |
|-------|---------|
| `carsSold` | Vehicles moved to `sold` in the period (salesperson: sold through their leads) |
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

### Insights — Admin only (website analytics, ADR-0016)

The owner's marketing and pricing view: where website visitors come from, which cars they look at, and what they search for. Data comes from the customer website's events (`POST /public/events`), lead attribution, leads and vehicles. The encrypted finance vault is never read; prices are the plaintext `listedPrice`.

Salespeople get `403 FORBIDDEN` (`"Only admins can view insights"`).

| Method | Path | Success |
|--------|------|---------|
| `GET` | `/insights/traffic?period=month&showroomId=` | `200` |
| `GET` | `/insights/vehicles?period=month&showroomId=` | `200` |
| `GET` | `/insights/vehicles/:vehicleId?period=month&showroomId=` | `200`, `404 NOT_FOUND` when the car is not in scope |
| `GET` | `/insights/demand?period=month&showroomId=` | `200` |
| `GET` | `/insights/leads/:leadId` | `200`, `404 NOT_FOUND` when the lead does not exist |

- Every response carries `Cache-Control: private, max-age=60`.
- `period` works as on `/dashboard`: `today`, `week` (Monday start), `month` or `quarter`, default `month`, business timezone (`Asia/Kolkata`), counted **period to date**. Any other value returns `422 VALIDATION_ERROR`. A malformed `showroomId`, `vehicleId` or `leadId` also returns `422`.
- `period` in the response is the whole calendar period with the zone offset: `{ "from": "2026-11-01T00:00:00+05:30", "to": "2026-11-30T23:59:59+05:30" }`.
- `showroomId` is optional. Website visits belong to no showroom, so it narrows **leads and vehicles only**; visitor and session counts are site-wide.
- **Units:** `*Rate` fields are fractions (0–1, 4 places), `null` when the denominator is 0. `*Share` fields are whole percentages (0–100) that add up to 100 within a list.
- `channel` is one of `instagram_ads`, `instagram_organic`, `facebook_ads`, `facebook_organic`, `google_ads`, `google_organic`, `whatsapp`, `direct`, `referral`, `other` (classified by the server, ADR-0016).

**`GET /insights/traffic`**

```json
{
  "period": { "from": "2026-10-01T00:00:00+05:30", "to": "2026-10-31T23:59:59+05:30" },
  "visitors": 3412, "sessions": 4186, "leads": 74, "visitorToLeadRate": 0.0217,
  "previous": { "visitors": 2310, "sessions": 2851, "leads": 51, "visitorToLeadRate": 0.0221 },
  "channels": [
    { "channel": "instagram_ads", "visitors": 1820, "carViews": 1240, "testDriveOpens": 212, "leads": 47, "bookings": 14, "sold": 6 }
  ],
  "campaigns": [
    { "campaign": "Diwali SUVs", "content": "Creta reel", "visits": 742, "leads": 23, "leadRate": 0.031, "bookings": 7 }
  ],
  "devices": { "mobile": 2970, "desktop": 442 },
  "cities": [ { "city": "Kochi", "visitors": 1420 }, { "city": "Other", "visitors": 693 } ]
}
```

| Field | Meaning |
|-------|---------|
| `visitors` / `sessions` | Distinct visitor ids / sessions that started in the period. `previous` is the same elapsed span of the previous period |
| `leads` | Website test-drive leads **with attribution** created in the period (the sum of `channels[].leads`). Leads whose browser blocked analytics have no channel and are not counted here |
| `channels[]` | Per landing channel: distinct `visitors`, `carViews` and `testDriveOpens` in those sessions, and attributed `leads` credited to it (last touch). `bookings`: those leads that reached `booking_confirmed` or `converted`; `sold`: those now `converted`. Most visitors first |
| `campaigns[]` | Up to 10, by `utm_campaign` + `utm_content`. `visits` = sessions that landed with them; `leads` / `bookings` = attributed leads whose last touch carried them |
| `devices` | Distinct visitors by device |
| `cities` | Distinct visitors by edge city: top 4, then `Other` (the rest plus visits with no city) |

**`GET /insights/vehicles`** — live stock (`open` + `linked`), most viewed first.

```json
{
  "period": { "from": "…", "to": "…" },
  "items": [
    {
      "vehicleId": "uuid", "title": "2021 Hyundai Creta SX", "listedPrice": 1240000, "daysInStock": 18,
      "views": 486, "uniqueViewers": 312, "repeatViewers": 74, "testDriveOpens": 58, "contactClicks": 41,
      "leads": 14, "leadRate": 0.0449, "topChannel": "instagram_ads",
      "signal": { "code": "hot", "reason": "Strong demand. Hold firm, small or no discount." }
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `title` | `year make model variant` |
| `daysInStock` | Whole days since the vehicle was added |
| `views` / `uniqueViewers` | `car_view` events / distinct visitors in the period |
| `repeatViewers` | Visitors who viewed the car in 2 or more sessions |
| `contactClicks` | WhatsApp and call clicks on the car page |
| `leads` | Leads on this car created in the period, **any source** (walk-ins count as enquiries too) |
| `leadRate` | `leads ÷ uniqueViewers`; `null` with no viewers |
| `topChannel` | Channel with the most views; `null` with none |

`signal.code`, first rule that matches (medians are over live stock with at least 30 views):

| Code | Rule |
|------|------|
| `insufficient_data` | Fewer than 30 views |
| `hot` | Lead rate ≥ 1.5 × median and views ≥ median |
| `ageing_cooling` | 45 days or more in stock (the dashboard's aged-stock threshold) |
| `low_visibility` | Views below half the median |
| `seen_not_enquired` | Views ≥ median and lead rate ≤ half the median |
| `normal` | Anything else |

**`GET /insights/vehicles/:vehicleId`** — a vehicles row (any status, signal still judged against live stock) plus:

```json
{
  "…row fields…": "",
  "period": { "from": "…", "to": "…" },
  "daily": [ { "date": "2026-10-05", "views": 8, "leads": 0 } ],
  "priceChanges": [
    { "at": "2026-10-20T05:45:00.000Z", "from": 940000, "to": 890000,
      "before": { "viewsPerDay": 9, "leadsPerDay": 0 }, "after": { "viewsPerDay": 14.5, "leadsPerDay": 0.13 } }
  ],
  "channels": [ { "channel": "instagram_ads", "views": 198 } ],
  "budgetContext": { "segment": "Sedan", "shareBelowPrice": 64 }
}
```

| Field | Meaning |
|-------|---------|
| `daily` | Every day from the period start to today, zero-filled |
| `priceChanges` | Listed-price changes made in the period (setting the first price or clearing it is not a change). `before`: average per day over up to 14 days before the change day, never before the car was added. `after`: from the change day to today, up to 14 days. Rates have 2 places |
| `channels` | Views by channel in the period |
| `budgetContext.segment` | The car's body-type segment (`SUV`, `Hatchback`, `Sedan`, `MUV / MPV`, …, or `Other`) |
| `budgetContext.shareBelowPrice` | Share of website budget searches in the period capped **below** this car's price; `null` without a price or searches |

**`GET /insights/demand`**

```json
{
  "period": { "from": "…", "to": "…" },
  "budgetBands": [ { "band": "<4L", "searchShare": 18, "stockShare": 5 } ],
  "segments": [ { "label": "SUV", "demandShare": 34, "stockShare": 18, "gap": "under" } ],
  "zeroResultSearches": { "count": 63, "top": [ { "label": "Creta under ₹10L", "count": 18 } ] }
}
```

| Field | Meaning |
|-------|---------|
| `budgetBands` | Always the five bands `<4L`, `4-6L`, `6-8L`, `8-12L`, `12L+`, by inclusive ceiling (a "under ₹6L" search is `4-6L`). `searchShare`: website searches with a budget (`filter_apply` with `priceMax`); `stockShare`: live stock with a listed price |
| `segments` | Body-type segments seen in searches or stock, by `demandShare`. `demandShare`: searches that picked a body type; `stockShare`: live stock. `gap`: `under` when demand is 10+ points above stock, `over` when 10+ below, else `null` (always `null` before anyone has searched) |
| `zeroResultSearches` | Searches that found no car (`resultCount = 0`) in the period, and the top 3 by count, named from the filters (`Diesel Brezza`, `Automatic under ₹6L`) |

**`GET /insights/leads/:leadId`** — the website journey behind one lead (lead detail card).

```json
{
  "channel": "instagram_ads", "campaign": "Diwali SUVs", "content": "Creta reel",
  "firstVisitAt": "2026-10-22T14:12:00.000Z", "visits": 4, "viewsOfThisCar": 6, "galleryOpens": 3,
  "otherCarsViewed": [ { "vehicleId": "uuid", "title": "2019 Honda City VX", "listedPrice": 890000, "views": 2 } ],
  "intent": "high"
}
```

- A lead with no website attribution (walk-in, phone, or a visitor who blocked analytics) returns every field `null` / `0` / `[]`, with `intent: null`.
- `channel`, `campaign`, `content` are the last touch the lead is credited to. `visits` and `firstVisitAt` cover all of the visitor's sessions; `otherCarsViewed` lists up to 5 other cars, most viewed first.
- `intent`: `high` with 3+ visits, 4+ views of this car or 3+ gallery opens; `medium` with 2+ visits, 2+ views or a gallery open; else `low`.

### Finance — Admin only, encrypted (ADR-0014)

Finance data is encrypted with a key only the admin holds. Shipped: the **vault** (setting up the keys, unlocking, locking, changing the key, recovering), the **ledger** (tags and income/expense entries), **car money** (purchase rate, sale, quotes, landing cost, profit, dues) and **reports** (profit & loss, cash flow, profit per car, dues, stock, dashboard summary).

Every finance response sends `Cache-Control: no-store`. Salespeople get `403`.

| Method | Path | Body | Success |
|--------|------|------|---------|
| GET | `/finance/vault` | — (send `X-Finance-Session` if you have one) | `200` `{ initialized, confirmed, unlocked, expiresAt }` |
| POST | `/finance/vault/setup` | — | `201` `{ financeKey, recoveryKey }` |
| POST | `/finance/vault/confirm` | `{ recoveryKey }` | `200` vault status |
| POST | `/finance/unlock` | `{ financeKey }` | `200` `{ sessionToken, expiresAt }` |
| POST | `/finance/lock` | — (`X-Finance-Session`) | `204` |
| POST | `/finance/vault/change-key` | `{ currentKey }` + `X-Finance-Session` | `200` `{ financeKey }` |
| POST | `/finance/vault/recover` | `{ recoveryKey }` | `200` `{ financeKey, recoveryKey }` |

**Which screen to show.** Call `GET /finance/vault` when the admin opens Finance:

| `initialized` | `confirmed` | `unlocked` | Screen |
|---|---|---|---|
| false | — | — | Set up finance |
| true | false | — | Confirm recovery key (or set up again) |
| true | true | false | Enter finance key |
| true | true | true | Finance |

**Setup.** `POST /finance/vault/setup` returns both keys **once**; the server keeps no copy it can read. Show them with copy/print buttons and make clear that losing both means the finance data is gone for good. Then ask the admin to type the recovery key back in and send it to `POST /finance/vault/confirm`. Until then the vault can't be unlocked. Calling setup again before confirming replaces both keys.

**Keys.** The finance key looks like `FK-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` and the recovery key like `RK-XXXX-…` (13 groups). Input is forgiving: case, spaces, dashes and the letters O/I/L for 0/1 don't matter, and the prefix may be left off. A key that isn't in this shape gets `422 VALIDATION_ERROR` and doesn't count toward the lockout.

**Unlock session.** `POST /finance/unlock` returns a `sessionToken`. Send it as `X-Finance-Session` on every finance request.
- Keep it in memory on web (never `localStorage`), in Keychain/Keystore on mobile.
- It locks after **30 minutes idle** (each finance request extends it) and **8 hours** at most. `expiresAt` is the idle deadline. `GET /finance/vault` does not extend it.
- Any `423 FINANCE_LOCKED` means: drop the token and show the unlock screen.
- `POST /finance/lock` ends it (use on "Lock" and sign-out). Always `204`.

**Lockout.** Five wrong keys within 15 minutes (finance or recovery key) pause key entry for 15 minutes: `429 FINANCE_UNLOCK_BLOCKED`, with the minutes left in the message.

**Change key.** Needs an unlocked session and the current key. Returns the new finance key once. Other sessions end; the caller's stays unlocked. No data is re-encrypted.

**Recover.** For a lost finance key. `POST /finance/vault/recover` with the recovery key returns a **new finance key and a new recovery key** (the used one stops working). Every session ends.

#### Finance › Tags and Entries

Every request below needs `X-Finance-Session` (else `423 FINANCE_LOCKED`).

| Method | Path | Body / query | Success |
|--------|------|--------------|---------|
| GET | `/finance/tags` | `?includeArchived=true` | `200` `FinanceTag[]` sorted by name |
| POST | `/finance/tags` | `{ name, color? }` | `201` `FinanceTag` |
| PATCH | `/finance/tags/:id` | `{ name?, color?, archived? }` | `200` `FinanceTag` |
| GET | `/finance/entries` | filters below | `200` entry page |
| POST | `/finance/entries` | entry body | `201` `FinanceEntry` |
| GET | `/finance/entries/:id` | — | `200` `FinanceEntry` |
| PATCH | `/finance/entries/:id` | any entry field | `200` `FinanceEntry` |
| DELETE | `/finance/entries/:id` | — | `204` (soft delete) |

**Tags** are the admin's own labels (`FinanceTag` = `{ id, name, color, archived, createdAt, updatedAt }`). The first unlock creates the client's defaults: Purchase, Mediator commission, Painting, Service, Rubbing polish, Insurance, Tyres, Travel, Food, Fuel, Other. Names are 1–40 characters and unique ignoring case; `color` is `#RRGGBB` or `null`. Tags are archived, never deleted: an archived tag drops out of pickers and can't be added to entries, but entries that have it keep it.

**Entries.** Every rupee in or out is one entry:

```json
{
  "kind": "expense",
  "amount": 5000,
  "entryDate": "2026-10-20",
  "tagIds": ["<Painting tag id>"],
  "vehicleId": "<car id or null>",
  "purpose": null,
  "party": "Ace Paints",
  "note": "Bonnet and bumper",
  "showroomId": null
}
```

- `kind`: `income` (money received) or `expense` (money paid). Fixed once created.
- `amount`: rupees, above zero, up to two decimals.
- `tagIds`: up to 10. `party` ≤ 120 characters, `note` ≤ 1000; blank means none.
- **Car link.** Send `vehicleId` to tie the entry to a car (from the car's screen, prefill it). The entry then belongs to the car's showroom. `PATCH` with another `vehicleId` moves it; `vehicleId: null` unlinks it. Without a car it's a business expense or receipt, filed under `showroomId` or the admin's home showroom.
- **Purpose** says what a car-linked entry does to that car's numbers:
  - expense: `purchase` (a payment to the seller towards the purchase rate) or `cost` (default: painting, service, mediator…);
  - income: `sale` (default: a payment from the buyer) or `other`;
  - no car: always `general`.
  Linking, moving or unlinking resets the purpose to the default unless the same request sends one. Suggested UI: preselect `purchase` when the admin picks the "Purchase" tag.

`FinanceEntry` = `{ id, kind, amount, entryDate, purpose, tags: FinanceTag[], vehicle: { id, label } | null, party, note, showroomId, recordedBy, createdAt, updatedAt }`. `label` reads like `Maruti Swift · KA01AB1234`.

**Listing** `GET /finance/entries`:

| Query | Meaning |
|-------|---------|
| `from`, `to` | `YYYY-MM-DD`, inclusive. **Required** (max 366 days) unless `vehicleId` is set |
| `vehicleId` / `unlinked=true` | One car's entries (any dates) / business entries only |
| `kind` | `income` or `expense` |
| `showroomId` | One showroom |
| `tagId` | Comma-separated; entries with any of them |
| `purpose` | Comma-separated purposes |
| `minAmount`, `maxAmount` | Rupees |
| `search` | Matches party, note and tag names |
| `sort` | `date` (newest first, default), `-date`, `amount` (largest first), `-amount` |
| `limit`, `offset` | Paging as elsewhere |

Response: `{ items, total, limit, offset, truncated, totals: { income, expense, net } }`. `totals` cover every matching entry, not just the page, so a car screen can show money in and out from the same call (`?vehicleId=…`). `truncated: true` means more than 5,000 entries matched the date/car filters; narrow the range.

#### Finance › Car money

One car's buy-and-sell numbers (ADR-0015). Every request needs `X-Finance-Session`.

| Method | Path | Body / query | Success |
|--------|------|--------------|---------|
| GET | `/finance/vehicles/:vehicleId` | — | `200` car money (below) |
| PUT | `/finance/vehicles/:vehicleId` | `{ purchaseRate, purchasedOn?, ownerExpectedPrice?, minimumSellingPrice?, note?, listedPrice? }` | `200` `{ vehicleId, deal, sale, listedPrice }` |
| POST | `/finance/vehicles/:vehicleId/sale` | `{ finalisedPrice, soldOn }` | `200` same shape |
| DELETE | `/finance/vehicles/:vehicleId/sale` | — | `204` |
| GET | `/finance/vehicles/:vehicleId/quotes` | — | `200` quotes, newest first |
| POST | `/finance/vehicles/:vehicleId/quotes` | `{ amount, quotedOn, leadId, quotedTo?, note? }` | `201` quote |
| DELETE | `/finance/vehicles/:vehicleId/quotes/:quoteId` | — | `204` |
| GET | `/finance/vehicles?vehicleIds=a,b,…` | up to 100 ids | `200` summaries in the order asked |
| GET | `/finance/vehicles/awaiting-sale-price` | — | `200` `[{ vehicleId, label, soldLeadId }]` |

All amounts are rupees.

- **Deal (`PUT`).** The purchase rate agreed with the seller, plus optional purchase date, owner's expected price, minimum selling price and note. `PUT` replaces these fields; it never touches the sale. `listedPrice` is the public asking price (plaintext, used by lead matching): omit it to keep the current one, send `null` to clear it.
- **Sale.** `POST …/sale` records the finalised price and date. It doesn't change the car's status (that still follows leads), and it can be recorded before the deal. `DELETE …/sale` removes a sale recorded by mistake.
- **Quotes** are prices offered to a lead. `leadId` is **required** and must be a live lead (else `404 NOT_FOUND`); it doesn't have to be the car's linked lead. `quotedTo` (display name) and `note` stay optional. Every quote comes back with `lead: { id, name, phone }` (the lead's contact, or registered buyer), so no per-quote lead lookup is needed; it is `null` only for older quotes recorded without a lead. The newest quote is the current one.
- **Awaiting sale price** lists cars whose status is `sold` but whose finalised price isn't recorded yet. Show it as a to-do after converting a lead.

**Car money** (`GET /finance/vehicles/:vehicleId`):

```json
{
  "vehicleId": "…", "vehicle": { "id": "…", "label": "Maruti Swift · KA01AB1234" },
  "deal": { "purchaseRate": 500000, "purchasedOn": "2026-10-01", "ownerExpectedPrice": null, "minimumSellingPrice": null, "note": null },
  "sale": { "finalisedPrice": 560000, "soldOn": "2026-10-25", "soldBy": "…" },
  "listedPrice": 585000,
  "quotes": [ … ], "currentQuote": { "amount": 585000, "quotedOn": "2026-10-18", "leadId": "…", "lead": { "id": "…", "name": "Anil Kumar", "phone": "+919876500001" }, "quotedTo": null, … },
  "landingCost": 545000, "costs": 45000,
  "costBreakdown": [ { "tag": { "id": "…", "name": "Insurance" }, "amount": 15000, "count": 1 }, … ],
  "paidToSeller": 500000, "receivedFromBuyer": 560000,
  "profit": 15000, "owedToSeller": 0, "owedByBuyer": 0,
  "flags": { "purchaseRateMissing": false, "saleRecorded": true }
}
```

- `landingCost` = purchase rate + entries with purpose `cost`. `profit` = finalised price − landing cost (negative is a loss; `null` until both are known).
- `owedToSeller` = purchase rate − `purchase` payments (negative means overpaid; `null` without a purchase rate). `owedByBuyer` = finalised price − `sale` payments (`null` until the sale is recorded).
- `costBreakdown` groups cost entries by their **first** tag (so an entry with several tags is counted once); `tag: null` means untagged.
- The car's entries themselves come from `GET /finance/entries?vehicleId=…`.

**Car screen recipe:** `GET /vehicles/:id` for the car, then (when finance is unlocked) `GET /finance/vehicles/:id` for the money tab and `GET /finance/entries?vehicleId=:id` for the entry list. In the car list, send the page's ids to `GET /finance/vehicles?vehicleIds=…` and match rows by `vehicleId`.

#### Finance › Reports

All amounts are rupees; profits can be negative. Every request needs `X-Finance-Session`. Each report takes an optional `showroomId`. Every response has `truncated` (true means more than 5,000 entries were involved and figures may be incomplete; narrow the range).

| Method | Path | Query | Use it for |
|--------|------|-------|-----------|
| GET | `/finance/reports/pnl` | `from`, `to`, `period` | Profit & loss chart and table |
| GET | `/finance/reports/cash-flow` | `from`, `to`, `period` | Money in and out |
| GET | `/finance/reports/vehicle-profit` | `from`, `to`, `sort` | Which cars made or lost money |
| GET | `/finance/reports/dues` | — | Who still owes whom |
| GET | `/finance/reports/stock` | — | Money tied up in unsold cars |
| GET | `/finance/summary` | — | Dashboard money tiles |

- `from` / `to`: `YYYY-MM-DD`, inclusive, required for the first three. `period`: `day`, `week` (Monday start), `month` (default) or `year`. `day`/`week` reports cover at most 366 days; `month`/`year` at most 5 years (`422 DATE_RANGE_TOO_LONG`).
- `pnl` and `cash-flow` return `{ period, from, to, buckets, totals, truncated }`. Every period in the range has a bucket (`start`, `end`, `label`), even when empty, so a chart has every bar. Labels: `2026-10-25` (day, or the Monday of a week), `2026-10` (month), `2026` (year).

**Profit & loss** (per bucket: `sales, costOfSales, grossProfit, laterCarCosts, otherIncome, businessExpenses, netProfit, carsSold, carsMissingPurchaseRate, uncountedSales`):

- A car counts in the period of its **sale date**: its finalised price is `sales`; its purchase rate plus the cost entries dated on or before the sale date are `costOfSales`.
- Cost entries dated **after** the sale count in their own period as `laterCarCosts`.
- `otherIncome` = car income with purpose `other` + income with no car. `businessExpenses` = expenses with no car.
- `netProfit` = gross profit − later car costs + other income − business expenses.
- Payments to sellers and from buyers are not in profit & loss (they settle prices already counted), and costs of unsold cars aren't either (they're in stock).
- **A sold car without a purchase rate has unknown profit.** It counts in `carsSold` and `carsMissingPurchaseRate`, but stays out of `sales`, `costOfSales`, gross and net profit, and so do its later costs. Its finalised price is in `uncountedSales`; show e.g. "₹X of sales not counted until a purchase rate is entered". It joins the numbers as soon as the purchase rate is set.

**Cash flow** (per bucket: `in, out, net, cumulative, inFromBuyers, inOther, outToSellers, outCarCosts, outBusiness`): every entry on its own date, including payments to sellers and from buyers. `cumulative` is the running net from the first bucket.

**Profit per car**: cars sold in the range, `{ vehicle, soldOn, purchaseRate, costs, landingCost, finalisedPrice, profit }`. `sort`: `profit` (biggest first, default), `-profit`, `date` (newest first), `-date`. Car profit includes every cost on the car, also ones paid after the sale. Cars without a purchase rate are listed with `profit: null`; `totals` (`sales`, `landingCost`, `profit`) cover only cars with a purchase rate, and `totals.carsMissingPurchaseRate` / `totals.uncountedSales` show what was left out. `totals.cars` counts every row.

**Dues**: cars where something is still owed, `{ vehicle, purchaseRate, paidToSeller, owedToSeller, finalisedPrice, receivedFromBuyer, owedByBuyer }`, largest first. Negative means overpaid. `totals` add up only what is still owed.

**Stock**: cars with money in them, no recorded sale and status other than `sold`, `{ vehicle, status, purchaseRate, costs, landingCost, currentQuote, listedPrice }`. Dropped cars stay listed (with `status: "dropped"`) until dealt with. `totals.moneyInStock` is the sum of landing costs.

**Summary** (`GET /finance/summary`):

```json
{
  "thisMonth": { "from": "2026-11-01", "to": "2026-11-03", "sales": 0, "netProfit": -87000, "businessExpenses": 85000, "cashIn": 0, "cashOut": 87000 },
  "lastMonth": { "from": "2026-10-01", "to": "2026-10-03", … },
  "moneyInStock": 408000, "owedToSellers": 200000, "owedByBuyers": 0, "awaitingSalePrice": 0,
  "truncated": false
}
```

Each window also has `carsMissingPurchaseRate` and `uncountedSales` (same rule as profit & loss). `thisMonth` is month to date ("today" in the business timezone); `lastMonth` is the same span of the previous month, so the comparison is fair early in the month. Since finance is locked without the key, the regular `GET /dashboard` carries no money figures; show these tiles when finance is unlocked.

---

## Suggested admin UI map

| Screen | Endpoints |
|--------|-----------|
| Login | `POST /auth/login`, then `GET /auth/me` |
| App shell | `GET /auth/me` for name + roles + home showroom; `GET /notifications` `unreadCount` badge |
| Home | `GET /dashboard?period=` (admin: all; salesperson: mine) |
| Insights (admin) | `GET /insights/traffic`, `/insights/vehicles`, `/insights/demand` (`?period=`); car detail `GET /insights/vehicles/:id`; lead detail card `GET /insights/leads/:id` |
| Owners list / form | `GET/POST/PATCH /owners`, `GET /owners/:id` |
| Vehicle create | `GET /catalog/makes` → models → variants, then `POST /vehicles` |
| Vehicle list / detail | `GET /vehicles`, `GET /vehicles/:id`, `PATCH /vehicles/:id`, `POST /vehicles/:id/status`, `GET /vehicles/:id/status-history` |
| Vehicle photos / docs | signed upload then `POST /vehicles/:id/media` or `/documents` |
| Lead pipeline | `GET /leads?status=&assignedTo=&search=`, `POST /leads`, `PATCH /leads/:id`, `PATCH`/`DELETE /leads/:id/vehicle`, `PUT /leads/:id/assignment`, `POST /leads/:id/status`, `GET /leads/:id/status-history`, `GET`/`POST /leads/:id/follow-ups`, `POST /leads/:id/follow-ups/:followUpId/complete`, `POST /leads/:id/follow-ups/:followUpId/cancel` |
| Inbox | `GET /notifications`, `PATCH /notifications/:id/read` |
| Staff settings | `/users` (admin only) |

For `salesperson`, show owners, catalog, vehicles, leads, the inbox and their own dashboard, and hide staff settings, lead assignment, vehicle status buttons, media/document delete, and owner deactivate. Show everything for `admin`.

---

## Not shipped yet — do not design screens against these

- Owner self-registration / portal (`owners.userId` linking)
- Buyer accounts and registered-buyer inquiries (anonymous browse and test-drive requests are live under `/public`)
- Automatic lead assignment
- Password reset or change-own-password

Those stay on the backend roadmap (`docs/MVP_ROADMAP.md`). If you need a contract for a later screen, wait until the matching folder appears in this file and in Postman.
