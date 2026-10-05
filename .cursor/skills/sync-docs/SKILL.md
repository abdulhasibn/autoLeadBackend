---
name: sync-docs
description: >-
  Surgically align AutoLead status docs (README, docs/api.md,
  docs/MVP_ROADMAP.md, docs/schema.dbml, PROGRESS) with what actually
  shipped. Use when the user asks to sync docs, update markdown status, or
  after shipping a roadmap item / endpoint / migration.
disable-model-invocation: true
---

# Sync Docs

Status SoT: `docs/PROGRESS.md` (**Current stage** + **Next up**). Be surgical: grep for stale markers, edit only hits.

## Checklist

```
- [ ] 1. Delta: read Current stage / Next up / newest Log → "Shipped: … · Next: …"
- [ ] 2. Grep stale markers (below) — do not open every .md
- [ ] 3. Patch hits only
- [ ] 4. PROGRESS: refresh Current stage table + Next up; prepend Log
```

## 2. Grep

```bash
rg -n 'Not started|not yet|Not shipped|deferred|Deferred|Next:|Current phase|todo|pending' \
  README.md docs/api.md docs/MVP_ROADMAP.md
rg -n 'Table |enum|status' docs/schema.dbml   # only for tables touched by new migrations
```

## 3. Surfaces

| Surface | Align |
|---|---|
| `docs/api.md` | **Current phase** line, route list, request/response shapes, role gates for shipped endpoints |
| `docs/MVP_ROADMAP.md` | Status cells + Current line for the stint |
| `README.md` | Docs links / shipped blurb |
| `docs/schema.dbml` | Tables/columns/checks changed by new migrations |
| `CONTEXT.md` | Only if domain terms/statuses changed |

Do **not** rewrite `PRD.md`, `docs/architecture.md`, `docs/adr/*` to reflect build status (write a new ADR for decisions). Postman README is owned by `sync-postman`.

## Done

Every grep hit for shipped work is fixed; PROGRESS Log entry names the docs touched.
