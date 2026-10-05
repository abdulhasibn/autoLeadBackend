# The dashboard reads one SQL summary function

**Status:** accepted

`GET /dashboard` covers PRD §25 and §26 for the only staff who work leads today: admins. The PRD lists about 25 metrics. The endpoint keeps only those that lead to an action or a decision:

- **Four KPIs.** Each KPI measured over a period carries a `previous` value to compare against.
- **Three attention lists:** overdue follow-ups, leads with no follow-up, and aged stock.
- **Today's follow-ups.**
- **Pipeline and inventory counts.**

Several PRD items were dropped:

- PRD statuses that ADR-0011 removed ("under inspection" and "reserved").
- "Leads contacted", which has no definition.
- Per-salesperson performance.

Money metrics wait for finance (Stint 5).

## Decision

- All counts and capped lists come from **one** `stable` function, `public.dashboard_summary` → `private.dashboard_summary`. It is callable only by `service_role` and returns `jsonb`.
- The function returns **raw counts only**. The use case computes `conversionRate`, vehicle labels and `daysListed`. ADR-0009 sets the same rule for profit: business formulas stay out of SQL. Profit will be added once finance lands, computed by `calculateVehicleProfit`.
- Period windows are resolved in TypeScript, in `resolveDashboardWindow`, using the business timezone `BUSINESS_TIMEZONE`. The window is passed in as instants, so the SQL never deals with timezones.
- The function takes a nullable `p_assignee_id`. A salesperson view can then reuse it when salespeople start working leads again.
- **Follow-ups are judged per active lead, using the lead's latest open follow-up.** No endpoint completes follow-ups yet. If every past follow-up counted, "overdue" would only ever grow.

## Considered Options

- **About 15 PostgREST `count` queries.** Rejected. Each one is a network round-trip on the busiest screen.
- **A materialized view.** Rejected. "Today" and "overdue" depend on the time of the request, so the view would always be stale.
- **One endpoint per widget.** Rejected. The screen would need many calls, and none of the widgets is useful on its own.
