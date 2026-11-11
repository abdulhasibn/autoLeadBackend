# AutoLead backend

Domain language: `CONTEXT.md`. Architecture and conventions: `.cursor/rules/`.

## Workflow (enforced: see docs/WORKFLOW.md)

- Start every task with the `start-task` skill: a new `<type>/<slug>` branch from an up-to-date `dev`.
- Never commit on or push to `main`/`dev`. Finish with the `open-pr` skill (PR into `dev`). Never merge a PR yourself unless the user asks.
- After a PR is merged, run the `after-merge` skill. Never touch a merged branch again.
- Database work: read `docs/MIGRATIONS_LOG.md` and the newest `supabase/migrations/` files first. Check dev and prod are in sync, then plan. Every migration is a new file plus a log entry. Merged migrations are immutable. Prod writes need the user's explicit go-ahead.
- If a guardrail blocks you, don't look for a way around it. Tell the user what was blocked and why.
