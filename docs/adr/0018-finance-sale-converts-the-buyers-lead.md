# Recording a sale in finance converts the buyer's lead

**Status:** accepted (recorded after the fact, 2026-11-16) · reverses finance module plan §4.4 · builds on ADR-0006, ADR-0011

The finance module plan (`docs/plans/finance-module.md` §4.4) kept lead conversion free of finance: staff converted the lead (ADR-0011), and the client followed up with `POST /finance/vehicles/:vehicleId/sale` if the vault was unlocked. Finance only saved a price.

In practice that left a gap (PR #17, 2026-11-12). An admin could record a sale in finance on a car that was still `open` or `linked`: finance counted it as sold while the car stayed listed on the public site, kept taking leads, and the buyer's lead was never converted.

## Decision

- **A sale always closes against a lead.** `RecordVehicleSaleUseCase` (`src/features/finance/application/use-cases/record-vehicle-sale.use-case.ts`):
  - car already `sold` (its lead was converted from the CRM): only the price is saved, as before;
  - otherwise the request must name a `leadId`, or it fails with `422 SALE_NEEDS_BOOKED_LEAD`. Finance converts that lead through the `IFinanceLeadConversion` port, then saves the price.
- **Leads owns the conversion.** `BookedLeadConversionService` (leads feature) implements `IFinanceLeadConversion.convertBookedLead`. The lead must be linked to this car with status `booking_confirmed`, or it fails with `422 SALE_LEAD_NOT_BOOKED`. It then runs the normal `ChangeLeadStatusUseCase` to `converted`, so the car is sold and its other active leads become `vehicle_unavailable` exactly as in ADR-0011. Finance never writes `leads` or `vehicles` rows itself.
- **Leads reads finance back.** Undoing a conversion (`POST /leads/:id/reopen`, PR #19) is refused with `422 SALE_PRICE_RECORDED` while finance has a sale price. Leads asks through its own `IRecordedSaleLookup` port; finance's `RecordedSaleLookup` answers from the plaintext `vehicle_financials.sold_on`, so no unlocked vault is needed. `composition-root.ts` resolves it per call, because finance is composed after leads.
- **Finance reads lead names.** `SupabaseFinanceLeadLookup` reads `leads` with their `contacts` or registered buyer (`users`) for quote names and for the car's booked leads (`GET /finance/vehicles/:id` returns `bookedLeads`). It is a feature-local read port, following `SupabaseFinanceVehicleLookup`.

### Ordering, retries and idempotency

Converting the lead and saving the price write different aggregates through separate calls, so they are not one transaction. The order makes a retry safe, in the same way as ADR-0006:

1. Validate the price and date on a scratch deal. A bad price converts nothing.
2. If the car isn't sold, convert the lead (this sells the car).
3. Load the deal, record the sale, save it.

If step 3 fails, the car is already sold. Repeating the same request skips step 2 (the car is `sold`, and any `leadId` sent is ignored) and saves only the price. Until it is repeated, the car shows on `GET /finance/vehicles/awaiting-sale-price`, the existing "sold, price not recorded" safety net. Removing the price (`DELETE /finance/vehicles/:id/sale`) does not un-sell the car or reopen the lead; undoing a sale is price first, then `POST /leads/:id/reopen`.

## Consequences

- The finance plan's §4.4 ("lead conversion itself stays free of finance") and its compliance rows H5/H8 ("sale recording uses the deal repository plus the vehicle lookup port") no longer describe the code. The plan now points here.
- Finance depends on leads at composition time (`leadConversion: leads.bookedLeadConversion`), and leads depends on finance per call. Both directions go through narrow ports (ADR-0006); neither feature imports the other.
- Recording a sale needs a `booking_confirmed` lead on an unsold car. A cash buyer who never became a lead has to be entered as a lead first.

## Considered Options

- **Keep §4.4: the client converts, then records the price.** This was the plan. It leaves the API able to record a sale on an unsold, still-listed car, which is the gap above. *Why the server-side option was chosen over making the client do both calls is not written down in PR #17; owner to confirm.*
- **Save the price first, then convert.** Rejected in PR #17 ("the conversion runs before the save so a retry finishes a failed request"). Saved first, a failed conversion would leave a price on an unsold car, and the retry would have to tell a half-done sale from a finished one.
- **One RPC that converts and saves.** Not discussed in the PRs; noted here because it is the obvious alternative. It doesn't fit: the deal payload is sealed in the application layer (ADR-0014), so the price can't be written by a lead RPC. The ordering above gives the same outcome on retry.
