# Public marketplace is its own module with optional auth

**Status:** accepted

The staff vehicles API requires a bearer token and returns internal fields: owner, acquisition type, status history, sensitive documents. Buyers browse without an account (PRD §11), and must never see internal data (PRD §8.6, §18).

The marketplace gets its own feature module, `features/marketplace/`, with:

- **Its own router** using an optional bearer middleware. It attaches the actor when a valid token is present and never rejects a request for lacking one.
- **Its own query interface and public DTOs.** Only `available` vehicles are returned, with public fields only: catalog names, year, km, fuel, transmission, colour, listed price, location, and media URLs. There is no owner, acquisition type, financials or documents.
- **No imports from `features/vehicles`.** It reads through its own Supabase query adapter.

## Considered Options

- **Add public routes to the vehicles router** — rejected. It would punch holes in the auth middleware, and one DTO change could leak internal fields.
- **Filter internal fields in the existing DTO by role** — rejected. A missed field is a data leak, while a separate public DTO is safe by construction.
