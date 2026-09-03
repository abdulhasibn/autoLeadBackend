# API reference index

Thin catalogue of shipped HTTP endpoints. Property-level docs (enums, examples) will be added per feature as modules land.

**Base URL:** `http://localhost:3000` (local) — production URL TBD.

| Guide | Covers |
|-------|--------|
| _(none yet)_ | Feature guides added when modules ship |

---

## Shared conventions

| Item | Rule |
|------|------|
| Content-Type | `application/json` on JSON request/response bodies |
| Auth | `Authorization: Bearer <access_token>` unless marked public |
| Errors | `{ "error": { "code": string, "message": string } }` — no field-level details in production |
| Pagination | Query `limit` (default **20**, max **100**), `offset` (default **0**). Page shape: `{ items, total, limit, offset }` |
| Timestamps | ISO-8601 UTC strings (e.g. `"2026-09-02T12:00:00.000Z"`) |
| UUIDs | RFC 4122 string IDs in path params and id fields |

---

## Endpoint catalogue

### Platform

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Public. Returns `{ status: "ok", timestamp }`. |

---

## Not shipped yet

Auth, users, owners, vehicles, inventory, marketplace, leads, sales, finance, notifications — see [`MVP_ROADMAP.md`](MVP_ROADMAP.md).
