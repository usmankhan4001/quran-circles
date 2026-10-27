# Branch inventory

A snapshot on 2026-10-28, taken during the repository handover after `git fetch --all --prune`. `scripts/branch-cleanup.sh` (run as `pnpm branches`) prints the live list; it only lists unless you pass `--delete`. Refresh with `git fetch origin --prune` before trusting any number here.

## origin

One branch: `main`. Every lane and integration branch that earlier versions of this page listed (`integration/ui-redesign`, `release-now`, `lane/*`, `release/*`) no longer exists on origin. There are no tags on origin yet (the `v2-parked-2026-10-18` tag mentioned in older docs does not exist there). Nothing is waiting for a remote clean-up.

## Local branches

| Branch                        | Where                              | State                                                                                                                                                                                |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`                        | the main clone                     | Equal to `origin/main`                                                                                                                                                               |
| `lane/auth/admin-bootstrap`   | worktree `../qc-admin-bootstrap`   | Fully merged into `main` (merge `15d70d0`). Its origin branch is gone. Clean worktree, locked                                                                                        |
| `lane/data/tanzeem-seed`      | worktree `../qc-tanzeem-local`     | All commits are in `main`: the earlier ones by merge `6797cf9`, the last three (`1ccfb29`, `9e11ea9`, `f905abb`) as equivalent commits applied on 2026-10-28. Clean worktree, locked |
| `claude/suspicious-faraday-*` | a Claude worktree under `.claude/` | Session branches for the handover; contain nothing that is not in `main` once pushed                                                                                                 |

The two lane worktrees are locked on purpose: worktree registrations on this PC have gone missing before ([worktrees](../agents/worktrees.md)). They are safe to remove with `git worktree remove` when the owner is done with them, but `../qc-tanzeem-local` also holds the owner's gitignored `.env` and the local seed database setup used by the runbooks in [`../archive/shared-folder/seeding/`](../archive/shared-folder/seeding/), so nothing was removed. Nothing was deleted in this reconciliation.

## Archive tags

Two tags kept old work that was never merged: `archive/lane-repo-merge-all` (everything in it is in `main`) and `archive/release-member-redesign` (one commit, `0993704`: a CSP, e2e and formatting chore whose Caddyfile change is already in `main`). They existed only on the owner's PC; they were pushed to origin on 2026-10-28 so the commits are not lost. Read them with `git show <tag>`; do not build on them.

## Stashes

None, in any worktree (`git stash list` is empty).

## Checking a branch before you delete it

If a branch was squash-merged or rebased, the script still calls it unmerged. Compare content, not hashes: `git cherry origin/main <branch>` prints `-` for a commit whose change is already in `main` and `+` for one that is not. Also check `git log origin/main..<branch>` and `git diff origin/main...<branch> --stat`.

## Worktrees

Parallel worktrees live in sibling `qc-*` folders (see [worktrees](../agents/worktrees.md)). Remove one with `git worktree remove <path>` only when `git -C <path> status` is clean. `git worktree prune` drops the bookkeeping for folders that no longer exist; it deletes no branches and no files.
