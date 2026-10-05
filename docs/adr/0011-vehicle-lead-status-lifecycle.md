# Vehicle and lead statuses drive each other

**Status:** accepted (extends [ADR-0006](./0006-cross-feature-coordination-via-ports.md))

Only admins add vehicles, so the owner-submission inspection pipeline (`submitted` → `approved` → `available` → `reserved`) is gone. Both lifecycles are now small, and each one updates the other automatically:

- **Vehicle:** `open`, `linked`, `dropped`, `sold`. An admin only drops or re-lists a vehicle.
  - `linked` holds exactly while at least one active lead points at the vehicle.
  - `sold` is set when a lead converts, and `vehicles.sold_lead_id` records that lead.
- **Lead:** `new`, `not_now`, `booking_confirmed`, `converted`, `lost`, `vehicle_unavailable`.
  - `new`, `not_now` and `booking_confirmed` are active.
  - Converting sells the vehicle, and every other active lead on it becomes `vehicle_unavailable` with its vehicle unlinked. That status is system-only and can be revived after linking another vehicle.
- **Dropping a linked vehicle** needs the admin to confirm, after a warning with the lead count. The vehicle's active leads are then unlinked and keep their status.

## Ports and wiring

Each consumer declares its own narrow port:

| Consumer | Port | Purpose |
|---|---|---|
| Leads | `ILinkableVehicleLookup` | Check that a vehicle can take a lead |
| Leads | `IVehicleLinkSync` | Flip the vehicle between open and linked |
| Leads | `IVehicleSale` | Sell the vehicle to a lead |
| Vehicles | `ILinkedLeads` | Count active leads and unlink them |

The two features now depend on each other at runtime. They still share no source imports: `LeadId` moved to `src/domain/shared`. `composition-root.ts` composes vehicles first, and passes it an `ILinkedLeads` adapter that resolves `leads` on each call.

## Atomicity

A conversion writes one vehicle and N leads, and a drop writes N leads and one vehicle. Both go through separate RPCs, so neither is a single transaction. A single cross-feature RPC is still rejected for the reason given in ADR-0006. Instead each step is idempotent, and the step that triggered the change is written last, so repeating a failed request finishes the job:

1. **Convert:**
   1. Sell the vehicle. This does nothing if it is already sold to this lead.
   2. Move the remaining active leads to `vehicle_unavailable`.
   3. Save the converting lead.
2. **Drop:**
   1. Unlink the active leads.
   2. Save the dropped vehicle.
3. **Link state:** it is recomputed from the vehicle's current active leads after every lead write. A stale `open` or `linked` value is corrected by the next write, and a sale corrects a stale `open` before selling.

## Considered Options

- **Derive `linked` at read time instead of storing it.** Rejected: the product wants it as a filterable status, and the stored value always heals.
- **Block dropping while leads exist.** Rejected in favour of warn-then-confirm, at the product owner's request.
- **In-process event bus or outbox.** Deferred. Revisit when conversion fan-out must also notify the affected salespeople, or must run asynchronously.
