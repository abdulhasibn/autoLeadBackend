---
name: architecture-compliance
description: >-
  Surgical audit of AutoLead plans and diffs against Clean Architecture
  hard-rejects (CQRS, layers, composition, cross-feature ports, shared branded
  IDs). Use when drafting or finalizing a plan for new/changed src/features/*,
  before CreatePlan for feature/CQRS/composition work, when the user asks for
  architecture compliance review, or when reviewing a PR/diff for architecture.
  Audits only — does not implement; use follow-architecture to place code.
---

# Architecture Compliance

**Audit, do not implement.** Verdict + evidence only. Fix code/plan only if the user asks. For placing new code while coding, use [`follow-architecture`](../follow-architecture/SKILL.md).

Sources of truth (do not invent rules):

1. `.cursor/rules/architecture.mdc` — read in full
2. `docs/architecture.md` §10, §16–17 (add folder-placement / shared branded IDs when ids cross features)

Expanded FAIL/PASS pairs: [`pitfalls.md`](pitfalls.md).

## When to run

- Before calling CreatePlan / marking final any plan that adds or changes feature modules, ports, CQRS split, or composition-root wiring
- On user request ("architecture compliance", "validate architecture")
- On a PR/diff that touches `src/features/**`, `src/app/composition-root.ts`, or `src/domain/shared/**`

Skip for pure meta/docs with no feature/port/composition design.

## Inputs (pick one)

| Input | How to audit |
|-------|----------------|
| Plan text/file | Every design claim → map to checks H1–H12 |
| Git diff / path list | Each changed file → layer → that layer's rejects |
| Feature `src/features/<name>/` | Tree + imports + use-case constructor deps |

## Method

1. Read the mandatory sources (narrow).
2. For each claim or file: assign layer → score applicable H-checks.
3. Each check: `PASS` | `FAIL` | `N/A` + **one** evidence line (plan quote or `path:symbol`).
4. Pitfall pass: run "assume FAIL until proven" list below.
5. Emit the output template. No essay.

**Stop rule:** Any hard-reject `FAIL` → verdict **FAIL**. Do not soften. Soft drifts never flip the verdict alone.

## Hard rejects (H1–H12)

Run all that apply; mark others `N/A`.

| ID | Check |
|----|-------|
| H1 | Feature anatomy: `domain/` · `application/` · `presentation/` · `infrastructure/` · `composition.ts` (+ tests as needed) |
| H2 | `composition.ts` imported only by `src/app/composition-root.ts` — never by feature internals |
| H3 | Presentation: no business logic; no Supabase; Zod delegates to VOs (`superRefine` / `transform`) |
| H4 | Application: no Express / Supabase / concrete repo class / SDK types in use-case signatures |
| H5 | **CQRS:** command UC ✗ query interface; read UC ✗ command repo; no fat merged port |
| H6 | Domain: no framework imports; no anemic entity; ports expose no SQL/table/row types; VOs invalid-state-proof |
| H7 | Infra: no business rules in repo; rows mapped; adapters not called past their port |
| H8 | Cross-feature: ✗ import other feature's `infrastructure/`; cross deps = ports wired at composition-root |
| H9 | Shared branded IDs: second unrelated feature needing e.g. `VehicleId` or `OwnerId` → type in `src/domain/shared` (not aggregate import, not fuzzy "same brand") |
| H10 | Scoped persistence: explicit ownership/scope args when the feature defines them + default `deleted_at IS NULL` on mutable entities |
| H11 | Authz in application policy — not trusted from client input alone |
| H12 | Display/reporting reads → query interface + read-model DTOs (not entity reconstitution) |

## Pitfall calculus (assume FAIL until proven)

- Soft-warn / "also fetch for UX" on a **write** → often H5 (query port on command UC). Require a **command-repo** lookup method.
- Nesting URLs under `/owners/...` → OK; handlers in owners presentation for another feature → H1/H8 FAIL.
- Importing another feature's aggregate or concrete adapter into this feature's application → prefer feature-local port + composition-root wire (H8).
- Soft warnings in 200/201 body → OK as application orchestration; FAIL if lookup violates H5.
- Ambiguous "shared or same brand pattern" for IDs → H9 FAIL until promotion path is explicit.

## Output template (use this structure)

```markdown
## Architecture compliance
**Scope:** <plan | diff | feature>
**Verdict:** PASS | FAIL (N hard-rejects)

| ID | Check | Result | Evidence |
|----|-------|--------|----------|
| H1 | … | PASS/FAIL/N/A | … |

### Hard rejects (must fix)
- [ID] <one line: violation + fix direction>

### Soft drifts (optional)
- …
```

## Done criteria

- Every applicable H-check scored with evidence
- Verdict matches stop rule
- Known FAILs fixed in the plan/diff **before** CreatePlan / "plan final" when this skill was the gate
