# Two sale models: bought outright or sold for a commission

**Status:** accepted · amends ADR-0015

ADR-0015 assumed the business only buys cars outright. On 2026-11-10 the client confirmed a second model: they market an owner's car and, once it sells, keep an agreed percentage of the sale price. There are only these two. "Intermediary sale" never happens.

How the money moves on a commission sale (client's answers):

- The buyer pays the full price to the dealership. The dealership pays the owner the price minus the commission.
- The commission percentage is agreed with each owner, per car.
- Money the dealership spends on the car (cleaning, repairs, ads) is recovered from the owner's payout.

## Decision

- **`vehicles.acquisition_type` has two values.** `dealership_purchase` is a purchase car; `consignment` is a commission car. `intermediary_sale` is retired: existing rows become `consignment` (migration `20261110120000_commission_sales`), and code still reading the old value treats it as `consignment`.
- **Finance reads the sale model from the car** (`FinanceVehicleFacts.saleModel`) and stays independent of the vehicles feature (ADR-0006).
- **Deal terms hold either a purchase rate or a commission %, never both.** The % is stored in the sealed deal payload as basis points (350 = 3.5%). Payloads sealed before this change have no commission field and read as purchase terms. Setting terms that don't fit the car's model is `INVALID_DEAL_TERMS`.
- **A commission car's money**, in the same pure domain function as ADR-0015:
  - commission = % × finalised price, rounded to the paisa
  - profit = commission (costs are recovered, so they don't reduce it)
  - landing cost = Σ `cost` expenses (money we've put in, shown as stock until sold)
  - owed to owner = finalised − commission − Σ `cost` − Σ `purchase` expenses (payouts); none until sold
  - owed by buyer = finalised − Σ `sale` income, as before
- **P&L** adds a `commissions` line on the sale date, part of gross profit. A commission car's costs never appear in P&L. A sold car missing its purchase rate *or* commission % is counted in `carsMissingPurchaseRate` and `uncountedSales`, as before.
- Purchase cars are unchanged.
- **"Sales" means purchased cars, on every screen** (amended 2026-11-23, issue UX-1). P&L `sales`, the finance summary's `sales` and the profit-per-car report's `totals.sales` all sum the finalised prices of sold purchase cars with a known rate. A commission car's full price is never "sales": it is returned apart as `commissionSalesValue` (P&L line and buckets, summary windows, profit-per-car totals), information only, outside cost of sales and profit. What we earn on those cars is `commissions`; the summary window also returns it. Screens label the figure "Sales (purchased cars)" and show the commission-car value and commission beside it. Rejected: counting commission cars' price as sales (overstates revenue with owners' money and needs a made-up cost of sales).

## Considered Options

- **Commission as a ledger entry the admin types in.** Rejected: the % is agreed up front, so the app can work it out, and a typed amount could disagree with it.
- **Costs reduce our commission.** Rejected by the client: costs come out of the owner's payout.
- **Keep `intermediary_sale` as a third model.** Rejected: the client never does it, and its profit rule was never defined (ADR-0009).
