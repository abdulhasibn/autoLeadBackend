# Finance is one ledger of tagged entries with a single profit formula

**Status:** accepted

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
