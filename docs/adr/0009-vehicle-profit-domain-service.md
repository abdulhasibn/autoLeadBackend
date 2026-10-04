# Vehicle profit is a domain service keyed by acquisition type

**Status:** accepted

PRD §27.3 defines profit differently by acquisition type:

- Dealership purchase: `selling price − (purchase price + vehicle expenses)`
- Consignment: `commission − vehicle expenses`
- Intermediary sale: to be confirmed with the business

These formulas are business rules. They MUST live in a pure domain function, `calculateVehicleProfit(acquisitionType, financials, expenses)`, in the finance feature, written test-first with one case per acquisition type. They MUST NOT live in SQL views or query builders.

Reports may still aggregate in SQL for speed, but any per-vehicle profit shown to users is computed by this function. Report totals are tested against it.

Recording a sale (`actual_selling_price`, `sold_at`, `sold_by` on `vehicle_financials`) belongs to a finance use case that runs alongside `markVehicleSold` (ADR-0006), not inside the vehicle status change.

## Considered Options

- **SQL view for profit** — rejected. It is not unit-testable, and the formula would drift from the PRD without anyone noticing.
