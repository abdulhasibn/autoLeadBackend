# Finance Phase 3 — car deal, sale, quotes, profit and dues

**Status:** approved plan · **Date:** 2026-11-02 · **Branch:** `feat/finance-3-car-money` · **Design:** `docs/plans/finance-module.md`

## Context

Phases 1–2 give an encrypted vault and an encrypted income/expense ledger with car links. Phase 3 turns a car's entries into the numbers the client actually asked for (ADR-0015, their worked example): **purchase rate**, **landing cost**, **quotes** to buyers, **finalised price**, **profit**, and what is still **owed to the seller / by the buyer** — plus a per-car summary for the car list and a "sold, price not recorded" list. Reports (P&L, cash flow) stay Phase 4.

Phase 2 shipped to `main` in `743f9eb`.

## Behaviour

**Deal** (one per car, stored in `vehicle_financials`; sealed payload bound to `vehicle_financials:<vehicleId>`):
- `purchaseRate` (agreed price paid to the seller), `purchasedOn`, optional `ownerExpectedPrice`, `minimumSellingPrice`, `note`.
- Sale: `finalisedPrice` + `soldOn` (sealed price; `sold_on` date and `sold_by` plaintext so SQL can find unpriced sold cars and Phase 4 can bucket by month). `DELETE …/sale` clears a mistaken sale.
- `listedPrice` stays **plaintext** (future marketplace, lead matching reads it).
- Recording a sale doesn't require the car's status to be `sold` (the admin may record the price first); the vehicles feature still owns status (ADR-0006/0009).

**Quotes**: `{ amount, quotedOn, leadId?, quotedTo?, note? }`, any number per car, newest = current quote. Soft delete.

**Numbers** (pure domain functions, ADR-0009/0015):
```
landingCost   = purchaseRate + Σ car expenses with purpose cost
profit        = finalisedPrice − landingCost              (null until both are known)
owedToSeller  = purchaseRate − Σ car expenses with purpose purchase   (signed; negative = overpaid)
owedByBuyer   = finalisedPrice − Σ car income with purpose sale       (null until finalised)
```
- `costBreakdown`: cost entries grouped by their **first** tag (no double counting when an entry has several tags), else "Untagged"; each group `{ tag, amount, count }`.
- Flags: `purchaseRateMissing`, `saleRecorded`.
- Client fixture must give landing ₹5,45,000, profit ₹15,000, owed 0 / 0.

## API (bearer + Admin + `X-Finance-Session`)

| Method | Path | Notes |
|---|---|---|
| GET | `/finance/vehicles/:vehicleId` | `{ vehicle: {id,label}, deal, sale, listedPrice, quotes, currentQuote, landingCost, costBreakdown, profit, owedToSeller, owedByBuyer, paidToSeller, receivedFromBuyer, flags }` — one call for the car's money tab (entries come from `GET /finance/entries?vehicleId=`) |
| PUT | `/finance/vehicles/:vehicleId` | `{ purchaseRate, purchasedOn?, ownerExpectedPrice?, minimumSellingPrice?, listedPrice?, note? }` (full replace of deal fields; sale untouched) |
| POST | `/finance/vehicles/:vehicleId/sale` | `{ finalisedPrice, soldOn }` |
| DELETE | `/finance/vehicles/:vehicleId/sale` | clears sale; 204 |
| GET | `/finance/vehicles/:vehicleId/quotes` | newest first |
| POST | `/finance/vehicles/:vehicleId/quotes` | `{ amount, quotedOn, leadId?, quotedTo?, note? }` → 201 |
| DELETE | `/finance/vehicles/:vehicleId/quotes/:quoteId` | 204 |
| GET | `/finance/vehicles?vehicleIds=a,b,…` | ≤ 100 ids → `[{ vehicleId, purchaseRate, landingCost, currentQuote, finalisedPrice, profit, owedToSeller, owedByBuyer }]` for the car list |
| GET | `/finance/vehicles/awaiting-sale-price` | cars with status `sold` and no recorded sale: `[{ vehicleId, label, soldLeadId }]` |

Route order: `/vehicles/awaiting-sale-price` before `/vehicles/:vehicleId`. Unknown/deleted car → 404 (writes); reads of a deleted car still work for history.

## Migration — `supabase/migrations/<ts>_finance_vehicle_deal.sql`

- `vehicle_financials`: drop `owner_expected_price, company_purchase_price, expected_selling_price, minimum_selling_price, commission_amount, commission_percent, other_costs, actual_selling_price, sold_at`; add `payload text`, `key_version integer` (both null until a deal is set; check both-or-neither), `sold_on date`. Keep `listed_price`, `sold_by`, `updated_at`. Existing plaintext prices are seed data and are dropped (ADR-0015).
- `vehicle_quotes`: `id uuid pk` (app-generated), `vehicle_id → vehicles not null`, `lead_id → leads null`, `quoted_on date not null`, `payload text not null`, `key_version int not null`, `created_by → users`, `created_at`, `deleted_at`; index `(vehicle_id, quoted_on) where deleted_at is null`. RLS on, no policies.
- Apply to hosted after your OK; regenerate types (take generated `Tables` section, keep PostgREST `14.5`); `docs/schema.dbml`.
- Seeders: `scripts/seed-test-data.ts` `FinancialsRow` keeps only `vehicle_id, listed_price, sold_by, updated_at` (drop price/commission logic and `sold_at`/`actual_selling_price` at ≈1269–1296, 1706–1712); `scripts/seed-demo-vehicles.ts:409` inserts only `listed_price`.

## Files — `src/features/finance/`

**domain/** — `vehicle-deal.entity.ts` (`create/reconstitute`, `setTerms`, `recordSale(finalisedPrice, soldOn, by)`, `clearSale`), `vehicle-quote.entity.ts` + `vehicle-quote-id.ts`, `vehicle-money.ts` (`calculateVehicleMoney(deal | null, entries)` → landing, breakdown, profit, dues, paid/received; pure), `sealed-finance-records.ts` (+ `SealedVehicleDeal`, `SealedVehicleQuote`), ports `vehicle-deal.repository.ts` (find, save), `vehicle-deal.queries.ts` (findSealed, findSealedMany), `vehicle-quote.repository.ts` (findById, save), `vehicle-quote.queries.ts` (listForVehicle, latestForVehicles), `finance-vehicle-lookup.port.ts` gains `listSoldWithoutSale()`; `finance-entry.queries.ts` criteria gains `vehicleIds` (for summaries).

**application/** — `services/vehicle-deal.sealer.ts`, `services/quote.sealer.ts`, DTOs (`vehicle-finance.dto.ts`, `vehicle-finance-summary.dto.ts`, `vehicle-quote.dto.ts`, commands), use cases `get-vehicle-finance`, `set-vehicle-deal`, `record-vehicle-sale`, `clear-vehicle-sale`, `list-vehicle-quotes`, `add-vehicle-quote`, `delete-vehicle-quote`, `list-vehicle-finance-summaries`, `list-vehicles-awaiting-sale-price`. Read use cases use queries ports only; writes use repositories.

**infrastructure/** — `supabase-vehicle-deal.repository.ts` (upsert on `vehicle_id`, writes payload/key_version/sold_on/sold_by/listed_price), `supabase-vehicle-deal.queries.ts`, `supabase-vehicle-quote.repository.ts` / `.queries.ts`, mappers; lookup `listSoldWithoutSale` (vehicles `status='sold'`, `deleted_at is null`, left join `vehicle_financials` with `sold_on is null`); entry queries `vehicleIds` → `.in('vehicle_id', …)`.

**presentation/** — schemas (`vehicle-deal.schemas.ts`, `vehicle-quote.schemas.ts`; reuse `amountSchema`, `calendarDateSchema`, `optionalTextSchema` from `finance-fields.schemas.ts`, `optionalCsvSchema` for `vehicleIds`), 9 controllers, routes in `finance.routes.ts`, wiring in `composition.ts`.

## Docs and tooling

`docs/api.md` (Finance › Car money; route count 62 → 71; "car screen" recipe), Postman Finance › Car money folder (audit must add no gaps), `docs/PROGRESS.md`, roadmap 5.2 → Done (Stint 2.3 acquisition prices absorbed), `src/app/tests/routes.test.ts`.

## Tests

- `calculateVehicleMoney`: client fixture (₹5,45,000 / ₹15,000 / 0 / 0); no deal → landing = costs, profit null, `purchaseRateMissing`; unsold → profit null, owedByBuyer null; overpaid seller → negative owed; post-sale cost lowers profit; `other` income and `general` ignored; breakdown uses first tag, untagged bucket.
- Deal entity: terms replace; sale record/clear; amounts > 0.
- Sealers: round-trip; payload hides prices; AAD bound to vehicle id.
- Use cases: set deal + get money for client example end to end; record/clear sale; awaiting list (sold without sale, excludes recorded); quotes add/list newest-first/delete, current quote; summaries for several cars incl. one with no data; unknown car 404; locked 423; salesperson 403.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test`; architecture checks (read UCs on queries only, no cross-feature imports).
2. Apply migration after your OK; advisors.
3. Dev server with a temporary vault: client example on a seeded car (deal ₹5,00,000, entries from Phase 2, sale ₹5,60,000) → `GET /finance/vehicles/:id` shows landing ₹5,45,000 / profit ₹15,000 / owed 0 / 0; quotes ₹5,85,000 → current quote; summaries for 2 cars; a seeded sold car appears in awaiting list until a sale is recorded; `GET /vehicles` lead matching still returns `listedPrice`.
4. `execute_sql`: `vehicle_financials.payload` / `vehicle_quotes.payload` ciphertext, no prices in plaintext columns; logs clean. Delete all test finance data afterwards.
