# Cross-feature coordination via narrow ports

**Status:** accepted (lead/vehicle example extended by [ADR-0011](./0011-vehicle-lead-status-lifecycle.md))

Some workflows span features: a lead closed as `sold` may also sell its vehicle, a lead write must notify the assignee, and a lead must check that a vehicle exists. The depending feature declares a narrow port in its own `domain/` (`ILiveVehicleLookup`, `IVehicleSale`). The owning feature implements it (`MarkVehicleSoldService`), and `composition-root.ts` wires the two together. Notifications and audit rows that must be atomic with a write go into the same RPC transaction, as `schedule_follow_up` and `save_lead` do.

Closing a lead with `markVehicleSold` writes two aggregates through two RPCs, so it is not one transaction. The order makes it safe instead:

1. Validate the lead transition in memory.
2. Sell the vehicle. This checks the vehicle graph before writing, and does nothing if the vehicle is already `sold`.
3. Save the lead.

If step 3 fails, the vehicle is sold and the lead is not. Repeating the same request finishes the job. Nothing is left that a retry cannot repair.

## Considered Options

- **In-process event bus** — rejected for now. The only coordination is an explicit user choice (`markVehicleSold`) plus writes that already live in RPCs. A bus would add indirection without removing any coupling. Revisit when one action fans out to several independent reactions, or when work must be async or retried.
- **Single cross-feature RPC** — rejected. It would move vehicle invariants into lead SQL and couple the two schemas.
- **Outbox table** — deferred until a reaction can fail independently and needs guaranteed delivery (e.g. email, WhatsApp).
