# Finance Phase 2 — tags and the income/expense ledger

**Status:** approved plan · **Date:** 2026-11-02 · **Branch:** `feat/finance-2-ledger` · **Design:** `docs/plans/finance-module.md`

## Context

Phase 1 (vault, keys, unlock sessions) is done on `feat/finance-1-vault` and verified end to end. Phase 2 delivers the client's core ask (ADR-0015): every rupee in or out recorded as an encrypted **Income** or **Expense** entry, labelled with configurable **tags**, optionally linked to a car (from the car's screen or the ledger) and re-linkable later. Car deal/profit/dues (Phase 3) and reports (Phase 4) build on this ledger.

Phase 1 shipped to `main` in `59df009`.

## Behaviour

**Entry** = `kind` (`income` | `expense`), `amount` (rupees, > 0, ≤ 2 decimals; stored as paise), `entryDate` (YYYY-MM-DD), `tagIds` (0–10), optional `vehicleId`, `purpose`, `party` (≤ 120 chars), `note` (≤ 1000 chars), `showroomId`.

| Rule | Detail |
|---|---|
| Purpose | Car-linked expense: `purchase` \| `cost` (default). Car-linked income: `sale` (default) \| `other`. Unlinked: always `general`. Wrong combo → 422 `INVALID_ENTRY_PURPOSE`. Linking, unlinking or moving to another car resets purpose to the default unless the same request sends one. The client may pre-pick `purchase` when the "Purchase" tag is chosen; the server doesn't infer from tag names (tags are renamable). |
| Showroom | Car-linked: the car's showroom (from the lookup; moves with the car link). Unlinked: body `showroomId` or the admin's home showroom via `resolveShowroomId` (`src/domain/shared/resolve-showroom.ts`). |
| Car link | Car must exist and not be deleted (any status, including sold) → else 404. |
| Tags | Unknown tag → 422 `FINANCE_TAG_NOT_FOUND`. Archived tags can't be **added** (422 `FINANCE_TAG_ARCHIVED`) but stay on entries that already have them. |
| Delete | Soft delete (`deleted_at`, ADR-0005). |
| Kind | Fixed after creation (change = delete + re-create), so purpose rules stay simple. |

**Tag** = `name` (1–40 chars, unique case-insensitively among all tags incl. archived → 409 `FINANCE_TAG_NAME_TAKEN`), optional `color` (`#RRGGBB`), `archived`. Never hard-deleted.

**Default tags**: Purchase, Mediator commission, Painting, Service, Rubbing polish, Insurance, Tyres, Travel, Food, Fuel, Other — created (encrypted) by `UnlockVaultUseCase` when the tags table is empty. That covers vaults set up before Phase 2 ships and avoids changing setup (no DEK-holding session exists at setup time anyway). Archived tags still count, so archiving everything never re-seeds.

**List** `GET /finance/entries`: SQL plaintext filters → decrypt → in-memory filters/sort/page.
- SQL: `from`/`to` (required, ≤ 366 days) unless `vehicleId` given; `kind`; `vehicleId` or `unlinked=true`; `showroomId`; `deleted_at is null`; hard cap 5,000 rows → `truncated: true`.
- Memory: `tagId` (csv, any-of), `purpose` (csv), `minAmount`/`maxAmount`, `search` (party, note, tag names; case-insensitive), `sort` = `date` (default, newest first) | `-date` | `amount` | `-amount`, `limit`/`offset`.
- Response: `{ items, total, limit, offset, truncated, totals: { income, expense, net } }` — totals over the whole filtered set, so a car screen shows its in/out without a second call.

**Entry DTO**: `{ id, kind, amount, entryDate, purpose, tags: [{ id, name, color, archived }], vehicle: { id, label } | null, party, note, showroomId, recordedBy, createdAt, updatedAt }`. `label` = "Make Model · REG" from the lookup (batched).

## API (all need bearer + Admin + `X-Finance-Session`)

| Method | Path | Notes |
|---|---|---|
| GET | `/finance/tags` | `?includeArchived=true`; sorted by name |
| POST | `/finance/tags` | `{ name, color? }` → 201 |
| PATCH | `/finance/tags/:id` | `{ name?, color?, archived? }` |
| GET | `/finance/entries` | filters above |
| POST | `/finance/entries` | 201; car screen sends `vehicleId` |
| GET | `/finance/entries/:id` | 404 if deleted |
| PATCH | `/finance/entries/:id` | any of `amount, entryDate, tagIds, vehicleId (uuid \| null), purpose, party, note, showroomId` |
| DELETE | `/finance/entries/:id` | 204 |

## Migration — `supabase/migrations/<ts>_finance_ledger.sql`

- `drop table public.expenses; drop table public.income;` (seed data only, ADR-0015).
- `finance_entries`: `id uuid pk` (app-generated, needed for AAD before insert), `showroom_id → showrooms not null`, `kind text check in ('income','expense')`, `vehicle_id → vehicles null`, `entry_date date not null`, `payload text not null`, `key_version int not null`, `recorded_by → users not null`, `created_at`, `updated_at`, `deleted_at`; indexes `(showroom_id, entry_date) where deleted_at is null`, `(vehicle_id) where deleted_at is null`, `(entry_date) where deleted_at is null`. RLS on, no policies.
- `finance_tags`: `id uuid pk`, `payload text not null` (`{ name, color }`), `key_version`, `created_at`, `updated_at`, `archived_at`. RLS on, no policies.
- Apply to hosted after you OK it (same flow as Phase 1); update `docs/schema.dbml`; add the two table blocks to `database.types.ts` and remove `expenses`/`income` (hand-merge, keep PostgREST `14.5` as in Phase 1).
- `scripts/seed-test-data.ts`: remove expense/income generation and inserts (≈ lines 189, 893–894, 2127–2277, 2549, 2608–2609) so the seeder and `pnpm typecheck` keep working; encrypted finance seeding stays Phase 5.

## Files — `src/features/finance/`

**domain/** — `entry-kind.value-object.ts`, `entry-purpose.value-object.ts` (`defaultFor(kind, linked)`, `assertValid(kind, linked)`), `tag-name.value-object.ts`, `tag-color.value-object.ts`, `entry-party.value-object.ts` / note limits inside the entity, `finance-entry.entity.ts` (`create`, `changeAmount`, `changeDate`, `retag`, `linkToVehicle(vehicleId, showroomId, purpose?)`, `unlink(showroomId)`, `changePurpose`, `softDelete`), `finance-tag.entity.ts` (`rename`, `recolor`, `archive`, `restore`), ids `finance-entry-id.ts`, `finance-tag-id.ts`, ports `finance-entry.repository.ts` (findById, save), `finance-entry.queries.ts` (listSealed(criteria) → sealed rows + `truncated`, getSealed(id)), `finance-tag.repository.ts` (findAll, findById, save, count), `finance-tag.queries.ts` (listSealed), `finance-vehicle-lookup.port.ts` (`find(id)` → `{ id, showroomId, label } | null`, `findMany(ids)`), `default-finance-tags.ts`, `sealed-finance-records.ts` (shared shapes: plaintext columns + `payload` + `keyVersion`).

**application/** — `services/entry.sealer.ts`, `services/tag.sealer.ts` (entity ↔ sealed record via `FinanceCipher`, AAD `finance_entries:<id>` / `finance_tags:<id>`; payload JSON validated on open → `DataIntegrityError`), `services/entry-read-model.builder.ts` (decrypted rows + tag map + vehicle labels → DTOs; in-memory filter/sort/page/totals), `errors/` (`finance-tag-not-found`, `finance-tag-archived`, `finance-tag-name-taken`, `invalid-entry-purpose` as `BusinessRuleViolationError` codes where 422), use cases `create-tag`, `update-tag`, `list-tags`, `create-entry`, `update-entry`, `delete-entry`, `get-entry`, `list-entries`. `unlock-vault.use-case.ts` gains default-tag seeding (tag repo + cipher from the new session). Every use case: `policy.requireAdmin` → `sessionService.open(ctx, token)` → work.

**infrastructure/** — `supabase-finance-entry.repository.ts`, `supabase-finance-entry.queries.ts`, `supabase-finance-tag.repository.ts`, `supabase-finance-tag.queries.ts`, mappers, `supabase-finance-vehicle.lookup.ts` (reads `vehicle_list` view for make/model/registration/showroom, `deleted_at is null`; precedent `src/features/leads/infrastructure/supabase-assignable-staff.lookup.ts`).

**presentation/** — `schemas/finance-entry.schemas.ts` (create/update/list; reuse `paginationQuerySchema` pattern from `src/features/leads/presentation/schemas/list-leads.schemas.ts`, `optionalCsvSchema`, `optionalSearchSchema`, `refineRange` from `src/presentation/validation/search.schemas.ts`; amounts via `Money.fromRupees`, dates via `CalendarDate`), `schemas/finance-tag.schemas.ts`, `schemas/finance-id.schemas.ts`, 8 controllers (token via `readFinanceSessionToken`), routes added to `finance.routes.ts`; `composition.ts` wiring + error mapper entries (409 tag name taken; others are `BusinessRuleViolationError` → 422 already).

## Docs and tooling

`docs/api.md` (Finance › Tags, Entries; error codes; route count 54 → 62; "car screen" usage), `postman/` Finance › Tags and › Entries folders with docs + examples (audit script must add no gaps), `docs/PROGRESS.md`, roadmap 5.1 → Done, `src/app/tests/routes.test.ts` protected routes.

## Tests (`src/features/finance/tests/`, real cipher, in-memory fakes)

- Purpose VO: every kind × linked combo; defaults.
- Entry entity: link/unlink/move reset purpose; explicit purpose kept; showroom follows car; amount/date/tags changes; soft delete.
- Sealer: round-trip; payload holds amount/tags/party/note, plaintext columns don't; AAD swap → integrity error.
- Use cases: create unlinked (home showroom) and from a car (car's showroom, default purpose); unknown car 404; unknown/archived tag 422; archived tag kept on edit; move car; unlink; delete then get 404; locked → 423; salesperson → 403.
- List: date range required/limited; vehicle scope without dates; tag/purpose/amount/search filters; sorts; totals over filtered set; pagination; `truncated`.
- Tags: create, duplicate name (case-insensitive, incl. archived) 409, rename, archive/restore; unlock seeds defaults once and never again.
- Client example as a ledger fixture: purchase payments 2,00,000 + 3,00,000, six costs = 45,000, buyer 50,000 + 5,10,000 → car-scoped totals income 5,60,000 / expense 5,45,000.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test`; architecture checks H1–H12 (incl. read use cases on queries ports only).
2. Apply migration to hosted after your OK; check advisors.
3. Dev server: set up + confirm + unlock a **test** vault → default tags appear → create the client's example entries against a seeded car → `GET /finance/entries?vehicleId=…` totals match → archive a tag, rename one → lock → 423.
4. `execute_sql` read-only: `finance_entries.payload` / `finance_tags.payload` are ciphertext; no amounts, names or notes in plaintext columns.
5. Log grep for keys, token, amounts → none. Delete the test vault, sessions, entries and tags afterwards.
