# Lead ↔ vehicle match score is computed in the application

**Status:** accepted

Staff record a buyer's preference on the lead: catalog make → model → variant, colours, fuel, transmission, body type, year window, km ceiling, previous owners, and the budget as a price ceiling. When they open a car they want each linked lead's fit as a percentage, plus a list of open leads that would suit the car.

## Decision

- The preference is stored as columns on `leads` (arrays for multi-choice fields, nullable numbers for limits) and written through `save_lead`, like the catalog preference before it. There is no separate table: the preference is 1:1 with the lead and always loaded with it.
- The score is a **pure domain function**, `scoreLeadAgainstVehicle` in `src/features/leads/domain/lead-vehicle-match.ts`. It weights the criteria, gives partial credit for near misses, and leaves out criteria the lead did not fill in. Budget is also left out while the car has no `vehicle_financials.listed_price`. The function is unit-tested and its weights live in one table.
- `GET /leads/vehicle-matches/:vehicleId` reads the car through the leads-owned port `IMatchableVehicleLookup`, which the vehicles feature implements (ADR-0006). It then reads a **bounded** candidate set: every lead linked to the car, plus at most the newest 1000 open, unlinked leads with any preference in the car's showroom. Each is scored in memory. A `truncated` flag tells the client when the bound was hit.
- `GET /leads/:id/vehicle-matches` runs the same scorer the other way round. It reads the lead, then up to the newest 1000 live cars in the lead's showroom that a lead can still link to (`open`, `linked`) through `IMatchableVehicleLookup.listMatchCandidates`, again with a `truncated` flag.
- Scores are computed on read and never stored. They depend on both the lead and the car (including a price that Stint 2.3 will start writing), so a stored score would go stale whenever either side changes.

## Considered Options

- **A SQL function that scores.** Rejected for now. The partial-credit rules would be duplicated in PL/pgSQL, out of reach of unit tests, and ADR-0009 already keeps business formulas out of SQL. Revisit if lead volume makes the in-memory pass slow.
- **A stored or materialized score per (lead, vehicle).** Rejected. Every lead edit, car edit or price change would have to recompute it.
- **Hard filters instead of a score.** Rejected. Staff asked for a percentage, and near misses (₹20k over budget, one year older) are often still worth a call.
