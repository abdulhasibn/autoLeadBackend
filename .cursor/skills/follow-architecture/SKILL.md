---
name: follow-architecture
description: >-
  Enforce AutoLead Clean Architecture and code-quality conventions when
  writing or changing backend code. Use when implementing features, adding
  use cases, entities, repositories, controllers, routes, Zod schemas,
  mappers, composition wiring, refactoring under src/, or when the user
  asks to follow architecture / code-quality rules.
---

# Follow Architecture

Make sure you follow the rules in @.cursor/rules/architecture.mdc @docs/architecture.md @.cursor/rules/code-quality.mdc

Those three files are the source of truth. If code conflicts with them, change the code (or write an ADR). Do not invent alternate layering or naming.

## Before writing code

1. Read `.cursor/rules/architecture.mdc` and `.cursor/rules/code-quality.mdc` in full.
2. Open only the sections of `docs/architecture.md` the change needs (usually §4–7, §9–11, §14, §16–17). Do not load the whole doc unless the task is architectural.
3. Name the feature module and the layer for every new file before creating it.

## Place code (Rule of Thumb §17)

Ask in order — stop at the first yes:

1. HTTP-specific (parsing, status codes, headers)? → **Presentation**
2. Orchestrating a workflow with no business rule of its own? → **Application**
3. A business rule, invariant, or calculation? → **Domain**
4. Persistence or external system call? → **Infrastructure**
5. Read for display/reporting, no invariant to protect? → **Application use case + Query Interface** (not command repo)

When in doubt, place closer to Domain than to the framework.

## Feature module shape

New or extended features live under `src/features/<name>/`:

```
domain/          # entities, value objects, repository + query interfaces
application/     # use cases, DTOs, policies
presentation/    # controller, routes, Zod schemas
infrastructure/  # supabase repo impl, mapper
composition.ts   # wire only; imported solely by src/app/composition-root.ts
tests/
```

- File names: kebab-case + layer suffix (`.entity.ts`, `.use-case.ts`, `.repository.ts`, `.queries.ts`, …) — see code-quality rule.
- Command repo and query interface are separate — never one fat interface.
- Use cases depend on interfaces only; concrete classes are wired in `composition.ts`.
- Domain IDs are branded strings; Value Objects use `private constructor` + `static create()`; Entities enforce transitions (no anemic setters).

## Dependency rule

```
Presentation → Application → Domain
Infrastructure → Domain (implements ports)
```

Hard rejects — do not ship if any appear:

| Layer | Reject if |
|---|---|
| Presentation | Business logic in controller · Supabase/SQL in handler · Zod re-implements a VO rule (delegate via `superRefine`) |
| Application | Supabase/SQL in use case · concrete repo class imported · SDK types in signatures · command UC uses query port or vice versa |
| Domain | Imports Express / Supabase / Pino / provider SDKs · invalid-state VO · anemic entity · SQL/table/row types on ports |
| Infrastructure | Business rules in repo · raw rows returned unmapped · adapter called past its port |

Also reject: presentation → infrastructure; feature A importing feature B's `infrastructure/`.

## After the change

Run the relevant items in `docs/architecture.md` §16 (Architecture Compliance Checklist) against the diff. Fix violations before considering the task done.

Completion criterion: every new/changed file sits in the correct layer, naming matches code-quality, and none of the hard rejects above are present.
