---
name: orient
description: Orient on AutoLead project stage and source-of-truth docs before planning or implementing. Use at the start of a session, before any plan, implementation, migration, feature work, or when the user gives a new task and context may be stale.
---

# Orient

Before planning or doing any user task, load project stage and only the docs that task needs. Do not invent status from memory or a prior chat.

## Mandatory first read

1. Read **Current stage** and **Next up** in `docs/PROGRESS.md`.
2. Skim the newest **Log** entry if the task touches work mentioned there.
3. State in one or two sentences: where the project is, and whether the user's ask matches **Next up** or is a detour.

Only after that: explore code, draft a plan, or edit files.

## Task-scoped reads (pick what applies)

| If the task involves… | Also read |
|------------------------|-----------|
| Domain language / naming | `CONTEXT.md` |
| Layers, modules, CQRS, composition | `docs/architecture.md` (relevant sections only) |
| Tables, constraints, RLS, migrations | `docs/schema.dbml` and/or `supabase/migrations/` for the tables touched |
| Product behavior / acceptance | `PRD.md` (relevant epic only) |
| Build order / stint sequencing | `docs/MVP_ROADMAP.md` |
| Soft-delete / CQRS / repository split | Matching ADR under `docs/adr/` |
| Supabase client / repos | `.cursor/rules/cursor-database.mdc` and existing `src/infrastructure/supabase/` |

Do **not** dump every doc into context. Read narrowly.

## Rules while oriented

- Prefer **Current stage** over assuming migrations, seeds, or features exist.
- If **Next up** conflicts with the user ask, say so briefly, then follow the user.
- Before calling CreatePlan or marking a plan final that adds/changes feature modules, ports, CQRS split, or composition-root wiring: apply [architecture-compliance](../architecture-compliance/SKILL.md). Do not finalize with known H\* FAILs.
- After a meaningful chunk of work, update `docs/PROGRESS.md` per `.cursor/rules/progress-log.mdc` (refresh Current stage / Next up; prepend a Log entry).
- Do not edit plan files to track progress — use the progress log.

## Skip orient only when

- The user asks a pure meta question (e.g. explain a skill, edit a rule) with no codebase change, **or**
- The same session already completed this checklist for the same task and `PROGRESS.md` was not updated since.
