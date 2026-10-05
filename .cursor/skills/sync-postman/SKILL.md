---
name: sync-postman
description: >-
  Sync the AutoLead API Postman collection: backend postman/ (source of
  truth) → ../autoLeadBackend-postman repo → Postman cloud "AutoLead API".
  Adds new APIs into a feature folder (never root), refreshes request Docs +
  Examples for every request. Use when the user asks to sync Postman, update
  the collection, or after shipping new HTTP endpoints.
disable-model-invocation: true
---

# Sync Postman

## Constants

| | |
|---|---|
| Source of truth | `postman/AutoLead-API.postman_collection.json` + `postman/AutoLead-Local.postman_environment.json` |
| Git mirror | `../autoLeadBackend-postman/` (github.com/abdulhasibn/autoLeadBackend-postman) + its `README.md` folder table |
| Cloud | My Workspace → collection **AutoLead API**, env **AutoLead Local** (find UID with `getCollections`; record it here once known) |
| Contract | `docs/api.md`, feature `*.schemas.ts`, DTOs, domain enums |

## Checklist

```
- [ ] 1. Diff shipped routes (src/features/*/presentation/*routes*) vs collection vs cloud itemRefs
- [ ] 2. Edit postman/ JSON: new requests inside the feature's top-level folder; env vars for new IDs
- [ ] 3. Refresh Docs + Examples for EVERY request
- [ ] 4. node .cursor/skills/sync-postman/scripts/audit-docs-examples.mjs  (exit 0)
- [ ] 5. Copy both files to ../autoLeadBackend-postman, update its README, commit + push
- [ ] 6. Cloud: prepare-put.mjs <uid> → putCollection (async); verify folders + spot-check
```

## Docs (request description) — bullet lists only, no `|---|` tables

1. `**Story:**` 1–2 plain-English sentences (actor + action + outcome), blank line.
2. Method + path + purpose; **Auth** (role: Admin / Salesperson).
3. Path / query / body: every property — required?, type, meaning, all enum values.
4. Success status + response fields; important error codes.

## Examples (saved responses)

- Mutations (POST/PATCH/PUT): success **and** one `4xx` `{ "error": { "code", "message" } }`.
- Reads: success; add 403/404 when common. `204`: one Example.
- Realistic DTO shapes, no tokens/PII. Name like `201 Created — …`, `422 — VALIDATION_ERROR`.

## Cloud

`putCollection` replaces the collection — request **scripts that store tokens/IDs must be in postman/ JSON** or they are lost (happened 2026-10-04). If only a few requests changed, `updateCollectionRequest` per request preserves cloud scripts. Never `createCollectionRequest` at root. Sync the environment with `putEnvironment` when vars changed.

## Done

Report folders/requests touched, audit result, mirror commit, cloud verified; prepend a `docs/PROGRESS.md` Log line.
