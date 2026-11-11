---
name: open-pr
description: >-
  Push the current task branch and open a pull request into dev, after the
  local checks pass. Use when the work on a task is done, or when the user
  says "ship it", "open a PR", "push this" or similar. This is the only way
  changes leave this machine.
---

# Open PR

## Steps

1. **Right branch.** `git branch --show-current` must not be `main` or `dev`,
   and must match `<type>/<kebab-slug>`. Check that
   `gh pr list --head <branch> --state merged` is empty. If the branch was
   already merged, stop: the work belongs on a new branch (`start-task`).

2. **Commit.** Commit everything that belongs to the task, following
   `.cursor/rules/git-conventions.mdc` (`type(scope): subject`, max 72
   characters, imperative). Never use `--no-verify`.

3. **Checks.** Run them and fix any failures before pushing:

   ```bash
   pnpm format:check && pnpm typecheck && pnpm lint && pnpm test
   ```

4. **DB changes.** If `git diff --name-only origin/dev...HEAD` lists
   anything under `supabase/migrations/`:
   - Each new migration has a row in `docs/MIGRATIONS_LOG.md`.
   - No already-merged migration file was edited.
   - Destructive SQL (`drop`, `truncate`, a type change, a rename) has a
     header comment saying how old code keeps working.
   - The PR body lists the migrations and whether each is backward-compatible.

5. **Push and open.**

   ```bash
   git push -u origin HEAD
   gh pr create --base dev --title "<type(scope): subject>" --body "<body>"
   ```

   Body sections: **Summary** (what and why), **DB changes** (migrations
   or "None"), **Test plan** (what was run and checked).

6. **Do not merge.** Merging is the user's call. Give them the PR URL and
   say that once it's merged, the `after-merge` skill moves you back to
   `dev`.
