# Finance is one ledger of tagged entries with a single profit formula

**Status:** accepted · amended by ADR-0017 (commission sales)

The client (requirements of 2026-10-26 and 2026-11-02) only buys cars outright and resells them; consignment and intermediary deals never happen. They want every rupee in or out recorded, any of it linked to a car from either the car or the ledger, free-form labels instead of fixed categories, part payments in both directions, and no income other than car sales. Their worked example: purchase ₹5,00,000 plus ₹45,000 of costs is a landing cost of ₹5,45,000; sold for ₹5,60,000 is a profit of ₹15,000.

## Decision

- **One ledger.** Every money movement is a `finance_entries` row of kind **income** (money received) or **expense** (money paid), with an amount, a date, zero or more **tags**, an optional car link, an optional party and note. `expenses` and `income` are dropped.
- **Tags, not categories.** `finance_tags` are created, renamed and archived by the admin. Archived tags stay on old entries. There are no fixed categories and no limits on repeats.
- **Purpose** says what a car-linked entry does to the numbers:
  - expense: `purchase` (payment to the seller) or `cost` (default);
  - income: `sale` (payment from the buyer, default) or `other`;
  - unlinked entries are `general`.
  Linking, unlinking or moving an entry resets its purpose to the default for the new state.
- **The car's deal** (`vehicle_financials.payload`) holds the agreed purchase rate and the finalised sale price. Quotes to people are kept as history in `vehicle_quotes`.
- **One formula**, in pure domain functions:
  - landing cost = purchase rate + Σ `cost` expenses for the car
  - profit = finalised price − landing cost (none until sold)
  - owed to seller = purchase rate − Σ `purchase` expenses
  - owed by buyer = finalised price − Σ `sale` income
  Purchase payments settle the purchase rate and are not added to landing cost, so nothing is counted twice.
- **P&L uses the profit view:** a car's purchase and costs count in the month it's sold; costs dated after the sale month count in their own month; unsold cars' costs show as stock, not loss. A separate cash-flow report shows money in and out by date.
- This supersedes the acquisition-type switch in ADR-0009. ADR-0009's rule that profit is a tested domain function, never SQL, still holds. Finance ignores `vehicles.acquisition_type`.

## Considered Options

- **Separate expense and income tables with fixed categories.** Rejected. The client wants configurable labels and one place to see all money.
- **Purchase rate only on the car, never as entries.** Rejected. The ledger would miss the largest payments, and dues to sellers couldn't be tracked.
- **Purchase payments as ordinary costs.** Rejected. Profit would count the purchase twice.
- **Payments in their own table.** Rejected. A payment is money in or out like any other entry; a second table would split the ledger.

## Amendment (2026-11): payments to the seller need the deal

A `purchase` expense on a car whose purchase rate (commission car: commission %) isn't recorded left "owed to seller", landing cost and profit unknown while the money had already gone out. Such a payment is now refused (`DEAL_TERMS_REQUIRED`) unless the request carries the terms (`deal`), which are saved with it; the entry is written first and removed if the deal save fails. The seller's paid status is derived from the `purchase` entries (`sellerPaymentStatus`), never stored, so editing or deleting an entry can't leave it stale. A change that pays the seller beyond the rate, or beyond an existing overpayment, is refused (`SELLER_PAID_ABOVE_RATE`) unless `keepOverpayment` is sent. The check reads the sealed entries rather than summing under a lock, so two simultaneous saves can still overpay; the money tab then shows it.

## Amendment (2026-11): tolerant reading of entry payloads

Entry payloads are read forward-compatibly so a release can be rolled back after a newer build has written new data (e.g. the `refund` purpose).

- **Unknown purpose:** read as `cost` (car-linked expense), `other` (car-linked income) or `general` (no car), never `sale` or `purchase`, so it can't settle a buyer or seller balance. This is not the kind's default for new entries (`sale` for income). It is logged as a warning (`finance.entry.unknown_purpose`, entry id, kind and fallback only).
- **Read-only on this build:** an entry read through that fallback can't be edited or deleted; both answer 422 `ENTRY_FROM_NEWER_VERSION`, so the stored purpose is never overwritten with the fallback.
- **Unknown extra keys** (e.g. `leadId`) are ignored on read and written back unchanged whenever the entry is saved.
- A corrupt payload (bad JSON, not an object, missing or invalid amount, wrong types) still fails as a data-integrity error.

## Amendment (2026-11-24, BE-78): stock is cash paid, not landing cost

The Stock report and the finance summary's stock figure showed landing cost (agreed purchase rate + costs). The owner asked for the cash that has actually left their pocket (QA 2026-11-24, CR-1). For an unsold car, **money in stock = Σ `purchase` expenses (payments to the seller) + Σ `cost` expenses**, in the pure domain function `cashPaidOnCar`. The agreed rate is not part of it: a car with a rate and no payments shows 0. Landing cost and profit are unchanged; stock rows still carry `purchaseRate` and `landingCost` as separate fields, and add `paidToSeller` and a per-row `moneyInStock`. `totals.moneyInStock` (report) and `moneyInStock` (summary) are the sum of the rows. A car is listed when it has a landing cost or any seller payment; the seller-payment condition is new (a commission car with only an advance has no landing cost). Rejected: showing max(rate, paid) or both figures in one total (the total would no longer match what was paid out).

## Amendment (2026-11-24, BE-77): buyer payments belong to the lead who paid them

A car's `sale` entries were summed as one buyer's money, so a token from a buyer who backed out reduced what the next buyer owed. The money now follows the lead.

- **Lead attribution.** A `sale` income and a new `refund` expense (money paid back to a buyer; expense purposes are `purchase`, `cost`, `refund`) carry an optional `leadId` inside the encrypted payload. No migration: older entries simply lack the key. `leadId` is kept only while the purpose is `sale` or `refund`.
- **Current buyers** are the sold lead (`vehicles.sold_lead_id`) once the car is sold, otherwise the leads with a confirmed booking. Any other lead with money on the car is a former buyer. For a lead, `net` = Σ `sale` − Σ `refund`.
- **Owed by buyer** = finalised price − net(sale lead). `receivedFromBuyer` = Σ net over the current buyers. A former buyer's net is shown as a **refund owed** (car money `refundsOwed`, Dues `refundsOwed` and `totals.owedBackToBuyers`, summary `owedBackToBuyers`), derived on read and never stored; it appears even when the car has no other dues.
- **Sale check.** `SALE_PRICE_BELOW_RECEIVED` compares the price with net(sale lead) + the payment sent with the sale. Remove-sale with buyer payments and "adjust" run on the server and touch only the sale lead's entries.
- **Who fills in `leadId`.** The request's `leadId`, else the only current buyer (`SALE_LEAD_REQUIRED` with several, `SALE_LEAD_NOT_ON_CAR` for a lead that isn't one, `SALE_NOT_RECORDED` unchanged for none). A `PATCH` that changes only `leadId` accepts any existing lead (admins correct history); a `PATCH` that keeps car, purpose and lead is never re-checked. A refund may not take a lead's net below zero (`REFUND_ABOVE_PAID`); like the seller check it reads entries without a lock, so two simultaneous saves can over-refund.
- **Older entries** count as the sold lead's on a sold car with a sold lead; elsewhere they are unassigned (a Dues row with no lead, assignable by `PATCH`). The payload stores `leadCarId` (the car the lead was validated against) next to `leadId`; a `leadId` whose `leadCarId` differs from the entry's car (an older build moved the entry after a rollback) is read as unassigned. A lead who moved to another car stays a former buyer: their money is a refund owed on the old car. There is no backfill: payloads need the admin's key and ADR-0014 rules out background jobs.
- **Rollback safety.** Builds with the tolerant reader (BE-77 PR 1) read a `refund` as a read-only `cost`, never as a sale or purchase.
- Rejected: a lead column on `finance_entries` (a plaintext link between a buyer and a car's payments, against ADR-0014) and moving a lost buyer's money to the next buyer automatically.
