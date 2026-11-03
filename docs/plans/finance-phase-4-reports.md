# Finance Phase 4 — reports and summary

**Status:** approved plan · **Date:** 2026-11-03 · **Branch:** `feat/finance-4-reports` · **Design:** `docs/plans/finance-module.md`

## Context

Phases 1–3 (on `main`, `4690e13`) record every rupee encrypted, link it to cars, and compute each car's landing cost, profit and dues. The admin still can't see the business as a whole: how much profit this month, where cash went, which cars made or lost money, who owes whom, and how much money sits in unsold stock. Phase 4 adds those reports plus a summary for the dashboard tiles (roadmap 5.3, and the money part of 6.3). Everything is computed after decryption in pure domain functions (ADR-0009/0015); nothing new is stored, so **no migration**.


## Report rules

**Periods**: `day | week (ISO, Monday) | month (default) | year`, bucketed on calendar dates (`entry_date`, `sold_on` are dates, so no timezone math). Only "today" for the summary uses `BUSINESS_TIMEZONE`.

**Profit & loss (profit view, finance-module §4.5):**

| Line | What counts | Bucketed by |
|---|---|---|
| Sales | finalised price of cars sold in the bucket | `sold_on` |
| Cost of sales | those cars' purchase rate + their `cost` entries dated **on or before the sale date** | `sold_on` |
| Gross profit | sales − cost of sales | |
| Later car costs | `cost` entries dated **after** their car's sale date | own date |
| Other income | car income with purpose `other` + unlinked income | own date |
| Business expenses | unlinked expenses | own date |
| Net profit | gross − later car costs + other income − business expenses | |

- Not in P&L: seller payments (`purchase`), buyer payments (`sale`) — they settle the purchase rate / finalised price; costs of unsold cars (they're stock).
- Refinement of §4.5: the cut-over is the **sale date**, not the sale month, so it works the same for day/week/month/year views. In a monthly view the two are identical except costs dated later in the sale month.
- Flag per bucket: `carsMissingPurchaseRate` (sold cars with no deal terms — cost of sales understated).
- Invariant (tested): over all time, Σ net profit = Σ car profits + other income − business expenses.

**Cash flow:** every entry by `entry_date`: `in` = income, `out` = expense, `net`, plus a running `cumulative` net across the range. Splits: in = from buyers / other; out = to sellers / car costs / business.

**Vehicle profit:** cars sold in range → `{ vehicle, soldOn, purchaseRate, costs, landingCost, finalisedPrice, profit }`, sortable by profit/date, with totals (reuses `calculateVehicleMoney`, `src/features/finance/domain/vehicle-money.ts`).

**Dues:** every car with finance data where `owedToSeller ≠ 0` or `owedByBuyer ≠ 0` → rows + totals (overpaid shows negative).

**Stock:** cars with finance data, no recorded sale, status not `sold` → `{ vehicle, status, purchaseRate, costs, landingCost, currentQuote, listedPrice }` + total "money in stock". Dropped cars stay listed (finance-module §4.6) with their status.

**Summary (dashboard tiles):** this month vs last month — sales, net profit, business expenses, cash in, cash out; plus money in stock, owed to sellers, owed by buyers, count awaiting sale price.

**Filters/limits:** `from`/`to` required for P&L, cash flow, vehicle profit; ≤ 366 days for `day`/`week`, ≤ 5 years for `month`/`year`. Optional `showroomId` (entries by their showroom, sold cars by the car's showroom). Reads cap at `MAX_LEDGER_ROWS`; responses carry `truncated`.

## API (bearer + Admin + `X-Finance-Session`)

| Method | Path | Query |
|---|---|---|
| GET | `/finance/reports/pnl` | `from, to, period?, showroomId?` → `{ period, buckets: [{ start, end, label, sales, costOfSales, grossProfit, laterCarCosts, otherIncome, businessExpenses, netProfit, carsSold, carsMissingPurchaseRate }], totals, truncated }` |
| GET | `/finance/reports/cash-flow` | same → buckets `{ in, out, net, cumulative, inFromBuyers, inOther, outToSellers, outCarCosts, outBusiness }` |
| GET | `/finance/reports/vehicle-profit` | `from, to, showroomId?, sort=profit\|-profit\|date\|-date` |
| GET | `/finance/reports/dues` | `showroomId?` |
| GET | `/finance/reports/stock` | `showroomId?` |
| GET | `/finance/summary` | `showroomId?` |

Empty buckets are returned (zeros) so charts have every period.

## Code

**Shared calendar (refactor):** move `localDate`, `monthStart`, `dayOfWeek` out of `src/features/dashboard/domain/dashboard-window.ts` into `src/domain/shared/business-calendar.ts` (`todayIn(now, tz)`, `startOfMonth`, `addMonths`, `startOfIsoWeek`, `startOfYear`, `daysBetween`) built on `CalendarDate` (`src/domain/shared/calendar-date.value-object.ts`); dashboard-window imports them (behaviour unchanged, its tests stay green). Finance must not import the dashboard feature.

**domain/** — `report-period.value-object.ts` (granularity, `bucketStart(date)`, `bucketsBetween(from, to)`, label, range limit), `build-profit-and-loss.ts`, `build-cash-flow.ts`, `vehicle-report-rows.ts` (vehicle profit / dues / stock rows from `calculateVehicleMoney`). Pure, no I/O. Ports: `vehicle-deal.queries.ts` + `findSoldBetween(from, to)`, `findWithData()`; `finance-vehicle-lookup.port.ts` facts gain `status` (`vehicle_list.status`).

**application/** — `services/finance-report-data.ts`: one loader that, given a cipher, decrypts deals + entries + tags for (a) a date range plus sold cars in it and their full entry history, or (b) all cars with finance data; reused by all six use cases so loading/decryption isn't duplicated. Use cases: `get-profit-and-loss`, `get-cash-flow`, `get-vehicle-profit-report`, `get-dues-report`, `get-stock-report`, `get-finance-summary` (read side only: queries ports + lookup). DTOs per report.

**infrastructure/** — `supabase-vehicle-deal.queries.ts` (`sold_on` range, `payload is not null or sold_on is not null`), lookup selects `status`.

**presentation/** — `schemas/finance-report.schemas.ts` (reuse `calendarDateSchema`, `uuidSchema`), 6 controllers, routes under `/reports` + `/summary`; `composeFinance` gains `timeZone` (from `config.businessTimeZone` in `src/app/composition-root.ts`, as dashboard does).

## Docs and tooling

`docs/api.md` Finance › Reports (rules above in plain words, chart-ready shapes; route count 71 → 77), Postman Finance › Reports folder (no new audit gaps), `docs/PROGRESS.md`, roadmap 5.3 → Done and 6.3 note ("money tiles: `GET /finance/summary`"), routes test.

## Tests

- Period: bucket start for each granularity (ISO week across year boundary, leap day), buckets between, range limits.
- P&L: client car sold in October → sales 5,60,000, cost of sales 5,45,000, gross 15,000 in October only; a cost dated after the sale lands in its own bucket as a later car cost; unsold car's costs absent; business rent and `other` income in their months; car missing purchase rate flagged; **all-time invariant**.
- Cash flow: buckets, splits, cumulative; seller/buyer payments counted here but not in P&L.
- Vehicle profit / dues / stock: rows and totals; overpaid negative; dropped car stays in stock; sold-but-unpriced car excluded from stock.
- Summary: this vs last month with a fake clock and timezone (IST month boundary).
- Use cases: locked 423, salesperson 403, `showroomId` filter, range validation 422.
- Dashboard window tests unchanged after the calendar refactor.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test`; layer checks (read use cases on queries only; no import from `features/dashboard`).
2. No migration. Dev server + temporary vault on hosted: client example car sold in October + October rent + a September cost on another unsold car → P&L October net matches hand calculation; cash flow totals equal ledger totals; stock shows the unsold car; dues empty; summary tiles match. Logs clean; delete test data and restore touched `vehicle_financials` rows afterwards.
