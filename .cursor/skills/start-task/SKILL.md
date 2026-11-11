---
name: start-task
description: >-
  Start any new piece of work (feature, fix, chore, docs, DB change) on a fresh
  branch cut from an up-to-date dev. Use at the start of every task, before
  editing any file, and whenever the user brings up a new task.
---

# Start task

Every task gets its own new branch from the latest `dev`. Branches are never
reused once their PR is merged. The guard hook and GitHub enforce this; this
skill does it the right way the first time.

## Steps

1. **Clean tree.** Run `git status --porcelain`. If anything is uncommitted,
   stop and ask the user what to do with it. Never stash or discard silently.

2. **Already on a task branch?** Run `git branch --show-current`. If it isn't
   `main`/`dev`, check `gh pr view --json state,number,url`:
   - PR **open**, and the new request is a follow-up to that PR: ask the user
     whether to continue there.
   - PR **merged**: run the `after-merge` skill first.
   - Otherwise: continue with step 3.

3. **Update dev.**

   ```bash
   git fetch --prune origin
   ```

   If `dev` is checked out here: `git switch dev && git pull --ff-only`.
   In a linked worktree (where `dev` is checked out elsewhere), skip the
   switch and branch from `origin/dev` in step 5.

4. **Name the branch** `<type>/<kebab-slug>`. Pick the type from:
   `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `db` (schema
   or migration work), `ci`, and `hotfix` (urgent prod fix, cut from `main`).
   Keep the slug short and specific, e.g. `feat/lead-export-csv`.
   Make sure the name has never been used:

   ```bash
   gh pr list --head <name> --state all --json number,state
   git rev-parse --verify --quiet refs/heads/<name> refs/remotes/origin/<name>
   ```

   If either finds anything, choose a different name (add `-2`, or be more
   specific).

5. **Create it.**

   ```bash
   git switch -c <name> --no-track origin/dev      # hotfix: origin/main
   ```

6. **Database work?** If the task touches `supabase/`, the schema, RPCs, or
   data, read `docs/MIGRATIONS_LOG.md` and the newest files in
   `supabase/migrations/` before planning. Confirm "Pending on prod" is
   empty or understood.

7. Tell the user the branch name in one line, then start the task.
