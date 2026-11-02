# Finance module plan (Stint 5, encrypted)

**Status:** draft for review · **Updated:** 2026-11-02 (client requirements round 1) · **Roadmap:** Stint 5 (5.1–5.4), absorbs Stint 2.3 (acquisition prices)

## 1. Goal

Track every rupee the business receives or spends, link any of it to a car, and show each car's landing cost, profit and outstanding dues, plus business-wide P&L and cash flow. Every amount, name and note is stored encrypted. Only an admin who has entered the business's **finance key** can read or write finance data. Developers, Supabase staff, backups and database dumps see ciphertext only.

## 2. Business model (from the client, 2026-10-26 and 2026-11-02)

### 2.1 The client's worked example

| Item | Amount |
|---|---|
| Purchase rate | ₹5,00,000 |
| Mediator commission | ₹10,000 |
| Painting | ₹5,000 |
| Service | ₹5,000 |
| Rubbing polish | ₹5,000 |
| Insurance / tyres (listed separately) | ₹15,000 |
| Other (travel, food, fuel) | ₹5,000 |
| **Total landing cost** | **₹5,45,000** |
| Quote price (to a buyer) | ₹5,85,000 |
| Finalised price | ₹5,60,000 |
| **Profit** = finalised − landing cost | **₹15,000** |

The client wrote "landing cost − final amount"; their numbers show finalised − landing cost, which is what we use.

### 2.2 Rules

| Topic | Rule |
|---|---|
| Acquisition | The business **only buys cars outright** and resells them. Consignment and intermediary deals never happen. Finance uses one profit formula and ignores `vehicles.acquisition_type`. |
| Entries | Every money movement is one **entry**, either **Income** (money received) or **Expense** (money paid). |
| What is an entry | All money received (each buyer payment: token, balance, anything else) and all money paid (each payment to a seller, repairs, mediator commission, travel, rent, salaries…). |
| Car link | Any entry can optionally be linked to a car. It can be created from the car's screen or from the entries screen, and linked, unlinked or moved to another car later. Unlinked expenses are business expenses. |
| Tags, not categories | Entries carry **free-form tags** (labels) such as Painting, Service, Insurance, Tyres, Mediator commission, Fuel. Zero or more per entry. Tags are configurable: the admin creates, renames and archives them. No hard rules. |
| Repeats | No limits: a car can have any number of entries with the same tag (two service bills, two mediators). |
| Mediator commission | Usually a car cost, recorded as an entry tagged "Mediator commission". An entry may name who was paid (`party`), so it stays flexible. |
| Quotes | A quote is a price offered **to a person** and changes during negotiation. Every quote is kept; the latest is the current one. A public marketplace price (`listed_price`) comes later and is separate. |
| Part payments | Both directions happen: the business may pay a seller in instalments and a buyer may pay a token, then the balance. The app tracks what is still owed each way. |
| Post-sale costs | Expenses may be added to a car after it's sold. The car's profit always includes them. |
| Other income | None beyond car sales; don't model loan or insurance commissions. An unlinked Income entry is still allowed for odd receipts. |

### 2.3 How the numbers work

Each car-linked entry has a **purpose**, chosen when it's saved:

| Entry | Purpose | Meaning |
|---|---|---|
| Expense linked to a car | `purchase` | A payment to the seller towards the purchase rate |
| Expense linked to a car | `cost` (default) | Painting, service, mediator, fuel… |
| Income linked to a car | `sale` (default) | A payment from the buyer towards the finalised price |
| Income linked to a car | `other` | Anything else received for that car |
| Unlinked entry | `general` | Business expense or odd receipt |

```text
Landing cost   = purchase rate (car card) + Σ cost expenses for the car
Profit         = finalised price − landing cost                (only once sold)
Owed to seller = purchase rate − Σ purchase expenses for the car
Owed by buyer  = finalised price − Σ sale income for the car
```

Purchase payments don't add to landing cost, because they settle the purchase rate that's already counted. This avoids double counting while still putting every rupee in the ledger.

With the client's example: purchase rate ₹5,00,000 paid as ₹2,00,000 + ₹3,00,000 (two `purchase` expenses), six `cost` expenses totalling ₹45,000, and a buyer paying a ₹50,000 token then ₹5,10,000 (two `sale` incomes). Landing cost ₹5,45,000, profit ₹15,000, nothing owed either way.

## 3. Decisions already made

| Topic | Decision |
|---|---|
| Users | The app is **admin-only until further notice**: the admin is the only person using it. Finance still checks the admin role (`FinancePolicy.requireAdmin`), so adding staff later needs no finance changes. |
| Who can read/write | Admin role only, and only while the finance vault is unlocked. |
| Key scope | One finance key for the whole business (not per showroom). |
| Where crypto runs | Backend, in the application layer, only while an admin session is unlocked ("session unlock", option B). The database layer only ever sees ciphertext. |
| Recovery | A recovery key is issued at setup, to be printed or stored offline. |
| Existing finance data | Seed data only: wiped by the migration. |
| Clients | Web and mobile use the same API. Neither does any crypto. |
| Plaintext by design | `listed_price` (future marketplace, used by lead matching) and lead `budget` stay plaintext. |

## 4. Open decisions (defaults used in this plan)

1. **Notes, party names and tag names encrypted?** Default **yes**. They often restate amounts and name people. It costs nothing, because filtering and search run in memory after decryption.
2. **Finance key format.** Default: **generated by the server at setup and shown once** (for example `FK-7Q2M-…`, 128-bit). The alternative is an admin-chosen passphrase, which is weaker but easier to remember.
3. **Session lifetime.** Default: 30 min idle, 8 h absolute. The app re-prompts for the key after that.
4. **Sale price at conversion.** Default: **captured in the conversion flow, but not required by it.** The admin is the only user, so whoever converts a lead (ADR-0011) holds the finance key. If finance is unlocked, the client follows the conversion with `POST /finance/vehicles/:vehicleId/sale`; if it is locked, the client offers "unlock and record price" or "skip". Lead conversion itself stays free of finance (ADR-0009, ADR-0006), so a skipped or failed price entry never blocks the sale. The "sold, price not recorded" list remains the safety net.
5. **When car costs hit the monthly P&L.** Default: **profit view**. A car's purchase rate and costs count in the month it's **sold**, together with its finalised price, so a month doesn't show a fake loss for stock. Costs added **after** the sale month count in the month they're dated, so closed months don't change. Unsold cars' costs show as "money in stock", not as losses. The cash-flow report shows the other view (money actually in and out by date).
6. **Cars that never sell** (dropped). Default: their landing cost stays in "money in stock" until the admin deals with it. Writing it off as a loss is a later feature.
7. **Reports per showroom?** Default: combined, with an optional showroom filter. `showroom_id` stays plaintext on entries.
8. **GST/tax.** Out of scope for now.

## 5. Security design

### 5.1 Keys

```text
finance key (admin)  ──scrypt──▶ KEK_f ─┐
recovery key (offline) ─scrypt──▶ KEK_r ─┼─ each wraps ──▶ DEK (random 256-bit, one per business)
                                         │
unlock session secret S ──HKDF──▶ KEK_s ─┘   (wrapped copy stored per session, expires)

DEK ──AES-256-GCM──▶ each row's encrypted payload
```

- **DEK (data encryption key).** A random 256-bit key generated at setup. It never leaves server memory in plaintext and is never stored in plaintext.
- **Key wrapping.** The DEK is stored wrapped by the finance key and, separately, by the recovery key, in `finance_vault`. Changing the finance key only re-wraps the DEK; no rows are re-encrypted.
- **Key derivation.** `scrypt` (Node built-in, no native dependency) with N=2¹⁷, r=8, p=1 and a random salt per wrap (OWASP minimums). It only runs on setup, unlock, key change and recovery. Argon2id via `@node-rs/argon2` is a drop-in alternative if we accept a native dependency.
- **Wrong-key detection.** The AES-GCM authentication check fails when the DEK is unwrapped with the wrong key, so no separate verifier is stored.

### 5.2 Unlock sessions

1. `POST /finance/unlock { financeKey }` (admin bearer). The server derives KEK_f, unwraps the DEK, generates a random 256-bit secret S, and stores `finance_sessions { id, user_id, wrapped_dek = AES-GCM(HKDF(S), DEK), idle/absolute expiry }`.
2. The response returns `sessionToken = <id>.<S>`. S is never stored server-side, so the database alone cannot unwrap the DEK.
3. Every finance request sends `X-Finance-Session: <token>`. The server loads the row, checks that it belongs to the caller and hasn't expired, unwraps the DEK in memory for that request, and slides the idle expiry.
4. `POST /finance/lock`, expiry, a key change or recovery deletes the session rows. The client keeps the token in memory (web) or in Keychain/Keystore (mobile) and never in `localStorage`.

### 5.3 Row encryption

- Each finance row has **plaintext metadata** (id, showroom, vehicle, kind, date, recorded by, timestamps, `deleted_at`) and one encrypted **`payload`** holding amounts, purpose, tag ids, party, and notes as JSON.
- **Payload format:** `v1.<keyVersion>.<base64(iv ‖ ciphertext ‖ tag)>`. The IV is 12 random bytes per write.
- **Swap protection:** the encryption is bound to `table:rowId`, so ciphertext copied to another row fails to decrypt.
- **Length padding:** plaintext JSON is padded to 256-byte buckets, so ciphertext length doesn't reveal how many digits an amount has.
- **Versioning:** `key_version` per row allows a future DEK rotation, done offline in the browser or by a script; that is out of scope for this stint.
- **Visible by design:** that a car has finance rows, how many, their dates, and whether each is income or expense. Amounts, purposes, tags and names are not visible.

### 5.4 Hardening

- **Rate-limited unlock.** After 5 failed unlocks in 15 min, unlock is blocked for 15 min and the attempt is recorded in `audit_logs`.
- **Audit without values.** Audit entries for finance actions record action, entity id and actor, never amounts or descriptions. Covers setup, unlock success/failure, lock, key change, recovery and every finance write.
- **Logger redaction.** Add `req.headers["x-finance-session"]`, `*.financeKey`, `*.recoveryKey`, `*.payload` and `*.dek` to `logger.ts` redaction.
- **No caching.** Finance responses send `Cache-Control: no-store`.
- **Safe errors.** Error messages never include decrypted values. A decryption failure becomes a typed `FinanceDataIntegrityError` (500) carrying the row id only.
- **Database lock-down.** Finance tables keep RLS on with no policies; only the service role, i.e. the backend, can reach them.
- **Honest limit (record in the ADR).** Whoever deploys backend code is trusted while an admin is unlocked. Mitigate with protected `main`, required reviews on `src/features/finance/**`, and redaction tests.

## 6. Data model changes (one migration)

| Table | Change |
|---|---|
| `finance_vault` (new, singleton) | `id`, `kdf` (jsonb: algorithm, params), `finance_salt`, `finance_wrapped_dek`, `recovery_salt`, `recovery_wrapped_dek`, `key_version`, `failed_unlocks`, `unlock_blocked_until`, `created_by`, `created_at`, `updated_at` |
| `finance_sessions` (new) | `id`, `user_id`, `wrapped_dek`, `created_at`, `last_used_at`, `idle_expires_at`, `expires_at`; index on `expires_at` for cleanup |
| `finance_entries` (new) | `id`, `showroom_id`, `kind` (`income` \| `expense`), `vehicle_id` (nullable), `entry_date`, `payload`, `key_version`, `recorded_by`, `created_at`, `updated_at`, `deleted_at`. Payload: `{ amount, purpose, tagIds[], party?, note? }`. Indexes on `(showroom_id, entry_date)` and `(vehicle_id)`. |
| `finance_tags` (new) | `id`, `payload` (`{ name, color? }`), `key_version`, `created_at`, `updated_at`, `archived_at`. Archived, never deleted, so old entries keep their labels. Seeded with the client's list: Purchase, Mediator commission, Painting, Service, Rubbing polish, Insurance, Tyres, Travel, Food, Fuel, Other. |
| `vehicle_financials` | Keep `listed_price`, `sold_at`, `sold_by`. Drop `owner_expected_price`, `company_purchase_price`, `expected_selling_price`, `minimum_selling_price`, `commission_amount`, `commission_percent`, `other_costs`, `actual_selling_price`. Add nullable `payload` + `key_version`. Payload: `{ purchaseRate, purchasedOn, ownerExpectedPrice?, minimumSellingPrice?, finalisedPrice?, note? }`. |
| `vehicle_quotes` (new) | `id`, `vehicle_id`, `lead_id` (nullable: the person quoted, when they are a lead), `quoted_on`, `payload` (`{ amount, quotedTo?, note? }`), `key_version`, `created_at`, `deleted_at` |
| `expenses`, `income` | **Dropped** (seed data only), replaced by `finance_entries`. |

Also update `docs/schema.dbml`, `database.types.ts`, and `scripts/seed-test-data.ts`. The seeder will create a vault with a **test-only** finance key, written to `.env` as `SEED_FINANCE_KEY` and never used in production, and encrypt its entries, tags, quotes and financials through the same cipher code. The client's worked example (§2.1) becomes a seeded car.

## 7. Feature design (`src/features/finance/`)

### Domain (pure, no crypto imports)
- **Value objects:** `Money` (integer paise, non-negative, `add`/`subtract`), `EntryKind` (income/expense), `EntryPurpose` (purchase/cost/sale/other/general, valid only for the matching kind and link), `TagName`, `ReportPeriod` (daily/weekly/monthly/yearly in `BUSINESS_TIMEZONE`, reusing the dashboard-window approach), `FinanceKey`, `RecoveryKey`.
- **Entities:**
  - `FinanceEntry`: kind, amount, date, purpose, tags, optional car. `linkToVehicle` / `unlink` reset purpose to the default for the new state.
  - `FinanceTag`: rename and archive.
  - `VehicleDeal`: purchase rate and date, optional owner-expected and minimum prices, finalised price and sale date.
  - `VehicleQuote`.
- **Domain services:**
  - `calculateVehicleProfit(deal, carEntries)` → landing cost, profit (null until sold), cost breakdown by tag. One formula; supersedes the acquisition-type switch in ADR-0009.
  - `calculateVehicleDues(deal, carEntries)` → owed to seller, owed by buyer.
  - `buildProfitAndLoss(deals, entries, period)` per open decision 5.
  - `buildCashFlow(entries, period)` → income − expense by date.
- **Ports:**
  - `FinanceCipher` (`seal(plain, aad)`, `open(sealed, aad)`), bound to one unlocked DEK.
  - `IFinanceVaultRepository`, `IFinanceSessionRepository`, `IKeyDerivation`.
  - `IFinanceEntryRepository` / `IFinanceEntryQueries`, `IFinanceTagRepository` / `IFinanceTagQueries`, `IVehicleDealRepository`, `IVehicleQuoteRepository`, `IFinanceVehicleLookup` (vehicle facts: registration, title, status, sold lead, showroom).

### Application
- **Session service:** `FinanceSessionService.open(ctx, token) → FinanceCipher`. It is the only way a use case obtains a cipher, so "locked" can't be bypassed.
- **Sealers:** `EntrySealer`, `TagSealer`, `VehicleDealSealer` and `QuoteSealer` map entity ↔ sealed record. This is where encryption and decryption happen. Repositories persist and return sealed records only.
- **Policy:** `FinancePolicy.requireAdmin`.
- **Use cases:**
  - Vault: `SetupVault`, `UnlockVault`, `LockVault`, `GetVaultStatus`, `ChangeFinanceKey`, `RecoverVault`.
  - Tags: `CreateTag`, `RenameTag`, `ArchiveTag`, `ListTags` (names unique, case-insensitive, checked after decryption).
  - Entries: `CreateEntry`, `UpdateEntry` (includes link, unlink, move car, change purpose), `DeleteEntry` (soft delete), `GetEntry`, `ListEntries`.
  - Vehicles: `SetVehicleDeal`, `RecordVehicleSale`, `AddQuote`, `DeleteQuote`, `GetVehicleFinance` (deal, entries, landing cost, breakdown, quotes, dues, profit), `ListVehiclesAwaitingSalePrice`.
  - Reports: `GetProfitAndLoss`, `GetCashFlow`, `GetVehicleProfitReport`, `GetDuesReport`, `GetStockReport`, `GetFinanceSummary`.
- **Filtering:** lists load sealed rows by plaintext filters in SQL (date range, kind, vehicle / unlinked, showroom), with a bounded window: a date range is required, max 366 days. Car-scoped lists have no date limit. Tag, purpose, amount range, text search, sort-by-amount and pagination then run in memory after decryption. Responses carry a `truncated` flag like ADR-0013.

### Infrastructure
- `NodeAesGcmCipher` and `ScryptKeyDerivation` (`node:crypto`).
- Supabase repositories and queries for vault, sessions, entries, tags, vehicle deals and quotes, and `SupabaseFinanceVehicleLookup`. The lookup reads `vehicles`, following the `supabase-assignable-staff.lookup` precedent; it's a feature-local port, not an import from another feature.

### Car screens (how vehicles and finance meet)
- The **client** composes the car screen: plaintext car details from `/vehicles/...`, accounts from `/finance/vehicles/...` with `X-Finance-Session`. Vehicles endpoints never return finance data and never touch the key.
- Finance locked (`423`): the car screen shows an "Unlock to view accounts" panel; the rest of the car loads normally.
- Adding an expense or payment from the car screen is `POST /finance/entries` with `vehicleId` set.
- The vehicles feature never imports finance; finance reads car facts through `IFinanceVehicleLookup` (ADR-0006).

### Presentation
- `finance.routes.ts` behind `requireAuth`. A small `financeSessionToken(req)` helper reads the header and passes the token into the command. Zod schemas delegate to the value objects; controllers stay thin.
- `Cache-Control: no-store` middleware on the router. `X-Finance-Session` is added to the CORS allowed headers.

## 8. API

| Method | Path | Notes |
|---|---|---|
| GET | `/finance/vault` | `{ initialized, unlocked, expiresAt }` (no session needed) |
| POST | `/finance/vault/setup` | Admin, once. Returns `financeKey` + `recoveryKey` **once**. |
| POST | `/finance/unlock` | `{ financeKey }` → `{ sessionToken, expiresAt }` |
| POST | `/finance/lock` | Ends the session. |
| POST | `/finance/vault/change-key` | Session + `{ currentKey }` → new `financeKey`. Ends other sessions. |
| POST | `/finance/vault/recover` | `{ recoveryKey }` → new `financeKey` + new `recoveryKey`. Ends all sessions. |
| GET/POST | `/finance/tags` | List (`includeArchived`) / create |
| PATCH | `/finance/tags/:id` | Rename, recolour |
| POST | `/finance/tags/:id/archive` | Hide from pickers; existing entries keep it |
| GET/POST | `/finance/entries` | List (`from`, `to`, `kind`, `vehicleId` or `unlinked=true`, `tagId`, `purpose`, `minAmount`, `maxAmount`, `search`, `sort`, `page`) / create. The car screen creates with `vehicleId` set. |
| GET/PATCH/DELETE | `/finance/entries/:id` | PATCH `vehicleId` (or `null`) links, moves or unlinks |
| GET | `/finance/vehicles?vehicleIds=…` | Per-car summary (landing cost, current quote, finalised price, profit, dues) for up to 100 cars, so the car list can show money columns. The client merges by `vehicleId`. |
| GET/PUT | `/finance/vehicles/:vehicleId` | GET: deal, entries, landing cost, tag breakdown, quotes, dues, profit. PUT: purchase rate, dates, optional prices. |
| POST | `/finance/vehicles/:vehicleId/sale` | Finalised price, sale date |
| GET/POST | `/finance/vehicles/:vehicleId/quotes` | Quote history / add quote (`amount`, `leadId` or `quotedTo`, `note`) |
| DELETE | `/finance/vehicles/:vehicleId/quotes/:quoteId` | |
| GET | `/finance/vehicles/awaiting-sale-price` | Sold vehicles with no finalised price |
| GET | `/finance/reports/pnl` | `period=daily|weekly|monthly|yearly`, `from`, `to`, `showroomId?` |
| GET | `/finance/reports/cash-flow` | Same parameters |
| GET | `/finance/reports/vehicle-profit` | Per-car profit for cars sold in range |
| GET | `/finance/reports/dues` | Cars with money owed to sellers or by buyers |
| GET | `/finance/reports/stock` | Unsold cars and their landing cost so far |
| GET | `/finance/summary` | Dashboard tiles: this month vs last month revenue, expenses, profit; money in stock; total owed each way |

New error codes:
- `423 FINANCE_LOCKED`: no or expired session.
- `409 FINANCE_NOT_INITIALIZED`, `409 FINANCE_ALREADY_INITIALIZED`.
- `409 FINANCE_TAG_NAME_TAKEN`.
- `422 INVALID_FINANCE_KEY`.
- `422 INVALID_ENTRY_PURPOSE` (e.g. `purchase` on an income entry or an unlinked entry).
- `429 FINANCE_UNLOCK_BLOCKED`.
- `500 FINANCE_DATA_INTEGRITY`.

## 9. Delivery (one PR per phase)

| Phase | Scope | Exit check |
|---|---|---|
| 0 | ADR-0014 "Finance data encrypted with session-unlocked keys". ADR-0015 "One ledger of income/expense entries with tags; single profit formula" (supersedes ADR-0009's acquisition-type switch, keeps its formula-in-domain rule). Update PRD notes, roadmap and `api.md` skeleton. | ADRs accepted by you. |
| 1 | Crypto + vault: migration for `finance_vault` / `finance_sessions`, cipher, KDF, session service, vault endpoints, rate limit, redaction, audit. | Unit tests: round-trip, tamper/AAD swap, wrong key, expiry, lockout. Redaction test proves keys and tokens never reach logs. |
| 2 | Tags + entries: migration (drop `expenses`/`income`, add `finance_entries`/`finance_tags`), CRUD, link/unlink/move, in-memory filters. | Use-case tests with a fake cipher, including purpose rules on link/unlink. A database read shows only ciphertext. |
| 3 | Vehicle deal, sale, quotes, profit and dues services (5.1, 5.2, Stint 2.3). | The client's worked example (§2.1, §2.3) is a test: landing cost ₹5,45,000, profit ₹15,000, nothing owed. Post-sale cost test. Part-payment dues test. |
| 4 | Reports: P&L, cash flow, vehicle profit, dues, stock, summary (5.3, 5.4). | Monthly P&L and cash flow match a hand-computed fixture. Over all time, P&L total = Σ car profits + unlinked income − business expenses. |
| 5 | Seeder encrypts finance data (incl. the client's example car), Postman folder, `api.md`, PROGRESS, smoke script. | `pnpm seed:test-data --dry-run` passes; Postman runs green against local. |

## 10. Architecture compliance (pre-check)

| ID | Result | Note |
|---|---|---|
| H1 | PASS | Full feature anatomy under `src/features/finance/`. |
| H2 | PASS | `composeFinance` is imported only by `composition-root.ts`. |
| H3 | PASS | The header is read in presentation; no crypto or rules there. |
| H4 | PASS | Use cases see the `FinanceCipher` port, never `node:crypto`. |
| H5 | PASS | Writes go through repositories, lists/reports through query interfaces. Sale recording uses the deal repository plus the vehicle lookup port. |
| H6 | PASS | `Money`, `EntryPurpose` and the other value objects reject invalid states; entities hold invariants. |
| H7 | PASS | Repositories store and return sealed records; no profit, dues or tag rules in SQL. |
| H8 | PASS | Vehicle facts come through the feature-local `IFinanceVehicleLookup`. |
| H9 | PASS | Reuses shared `VehicleId`, `UserId`, `ShowroomId`, `LeadId`. |
| H10 | PASS | Queries default to `deleted_at IS NULL`; showroom stays a plaintext filter. |
| H11 | PASS | `FinancePolicy.requireAdmin` plus the unlocked session. |
| H12 | PASS | Lists and reports return read-model DTOs. |

## 11. Risks

- **Lost finance key and recovery key means permanent data loss.** Setup must make the admin confirm they stored the recovery key (re-type its last block).
- **Wrong purpose skews numbers.** A seller payment saved as `cost` would double-count the purchase. Mitigation: the client defaults the purpose from the "Purchase" tag and shows "paid to seller so far / purchase rate" on the car screen, so a mismatch is visible.
- **scrypt memory use on Vercel** (~128 MB per derivation). Fine on default function memory. Unlock latency is about 0.3–0.5 s, acceptable for an explicit action.
- **Reports decrypt every row in range.** About 5k rows a year decrypt in well under 100 ms. The 366-day cap keeps it bounded. Profit and stock reports also load all entries for the cars involved, which is bounded by car count.
- **Backend deploys are trusted while unlocked.** Covered by process controls (§5.4), not by code.
- **Mobile parity.** No crypto in the app; it needs secure token storage and a re-prompt on `423 FINANCE_LOCKED`.

## 12. Out of scope

DEK rotation tooling, CSV/PDF export, multi-business keys, non-admin users (the app is admin-only until further notice), client-side (browser/app) encryption, GST/tax, write-offs for unsold cars, loan/insurance commission income, and the public marketplace price workflow. Removing consignment/intermediary from `vehicles.acquisition_type` is a separate vehicles change; finance ignores the field either way.
