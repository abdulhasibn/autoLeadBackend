---
name: after-merge
description: >-
  Clean up after a task's PR is merged: switch to dev, pull it up to date,
  and delete the merged branch so it is never worked on again. Use when the
  user says a PR was merged, when a session starts on a merged branch, or
  before starting the next task.
---

# After merge

## Steps

1. **Confirm the merge.**

   ```bash
   gh pr view --json number,state,mergedAt,baseRefName,url
   ```

   If `state` isn't `MERGED`, stop and tell the user. Don't clean up an
   unmerged branch.

2. **Nothing left behind.** Run `git status --porcelain`. If there are
   uncommitted changes, stop. They can't go on this branch any more.
   Ask the user whether to carry them to a new branch (`start-task`, then
   commit them there) or drop them.

3. **Switch to dev and update it.**

   ```bash
   git fetch --prune origin
   git switch dev
   git pull --ff-only
   ```

   **Linked worktree** (`git switch dev` fails because `dev` is checked out
   elsewhere): tell the user this worktree is finished and can be removed
   with `git worktree remove <path>` from the main checkout. Don't keep
   working in it.

4. **Delete the merged branch locally.** GitHub already deletes it on the
   remote.

   ```bash
   git branch -D <merged-branch>
   ```

   `-D` is needed because squash merges don't look merged to git. Step 1
   already confirmed it is.

5. **Verify.** `git status -sb` must show `## dev...origin/dev` with no
   ahead/behind. If `dev` shows local commits, tell the user and stop. They
   must not be pushed.

6. Report in one line: "PR #N merged; on dev at <short sha>, up to date."
   The next task starts with `start-task`.
