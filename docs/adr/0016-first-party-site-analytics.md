# First-party website analytics with server-side channel classification

**Status:** accepted

Wheels Experts is about to run Instagram ads that link to the customer website. Until now every test-drive request became `leads.source = 'website'` and no visit was recorded, so the owner could not tell whether a lead or a car's interest came from an ad, organic Instagram, Google or WhatsApp. The owner also wants demand signals (views, enquiries, price changes) to help with pricing and negotiation.

We capture website traffic ourselves, in Supabase through this backend, in a new feature module `features/site-analytics/`.

- **`POST /public/events`** takes batches of up to 20 events (`page_view`, `car_view`, `gallery_open`, `filter_apply`, `test_drive_open`, `whatsapp_click`, `call_click`, `directions_click`) with the session's raw landing touch: UTM tags, whether `fbclid` / `gclid` were present, the referring origin, the landing path and the in-app browser. It always answers `204`.
- **The server classifies the channel** (`domain/traffic-channel.ts`), the only place the rules live. The site never sends a channel, so the rules can be fixed without shipping a new client, and old sessions are not misfiled by an old client. Marketplace classifies lead attribution through an `ITouchClassifier` port wired to the same function (ADR-0006).
- **Test-drive requests carry optional attribution** (`visitorId`, `sessionId`, first and last touch). For a new lead `submit_public_test_drive` stores a `lead_attribution` row and credits a Meta last touch to `leads.source = 'instagram' | 'facebook'`; anything else stays `website`.
- **Listed-price history** is recorded by a trigger on `vehicle_financials.listed_price`, the only plaintext price. Demand insights never read the encrypted finance vault (ADR-0014).
- **Storage rules:** `web_sessions`, `web_events`, `lead_attribution`, `listed_price_history` have RLS on with no policies and are reached only through `service_role` (`private.fn` wrapped by `public.fn`, as in the marketplace migration). Events older than 13 months are pruned on ingest.

## Read side

The owner's Insights page reads this data through `features/insights` (admin only): `/insights/traffic`, `/insights/vehicles`, `/insights/vehicles/:id`, `/insights/demand` and `/insights/leads/:id`. Read-only SQL functions (`insights_*`) return raw counts in one round-trip each; rates, pricing signals, budget bands and labels are computed in the use cases, as with the dashboard (ADR-0012). Periods follow the dashboard's rules.

## Transport details

- The site sends with `navigator.sendBeacon` and a `text/plain` body holding JSON, so the request is CORS-simple and needs no preflight. The route parses `text/plain` as JSON.
- A CORS-safelisted beacon is a no-cors request, which `Cross-Origin-Resource-Policy: same-origin` (helmet's default) blocks with `ERR_BLOCKED_BY_RESPONSE`. Everything under `/public` is meant for another origin, so `/public` sends `Cross-Origin-Resource-Policy: cross-origin`. Staff routes keep `same-origin`.
- Abuse limits: 16 KB body, bot and blank user agents dropped, 500 events per session per hour, a session id reused by another visitor ignored, event times clamped to the last day. Invalid batches are dropped, not rejected, so a prober learns nothing.

## Privacy

The visitor id is a random id kept in the browser, never joined to a name or phone except through a test-drive request the visitor submits. IPs are stored only as an HMAC (the same key as the marketplace rate limit). The referrer is an origin, never a full URL. City comes from the edge (`x-vercel-ip-city`).

## Considered Options

- **GA4 / Meta Pixel** — rejected. Data would leave our system, ad blockers and in-app browsers drop much of it, and leads could not be joined to visits without sending personal data to a third party.
- **PostHog or another hosted product analytics tool** — rejected for now. Another vendor and bill for a handful of event types, and lead attribution still needs our own join.
- **Classify the channel in the browser** — rejected. Rules would be frozen into every shipped client and could be spoofed into any channel; sending the raw touch keeps the server authoritative.
