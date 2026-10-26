# Branch inventory

A snapshot on 2026-10-26, taken after the local clean-up. `scripts/branch-cleanup.sh` (run as `pnpm branches`) prints the live list; it only lists unless you pass `--delete`. Refresh with `git fetch origin --prune` before trusting any number here.

## Already removed (local)

These were fully contained in `integration/ui-redesign` and had clean worktrees, so the local branches and their worktrees were deleted on 2026-10-26: `lane/platform/go-live`, `lane/ui/member-redesign`, `lane/ui/session-screens`, `lane/admin-app/redesign`, `lane/console/redesign`, `lane/ui/member-journey`, `lane/ui/member-quran`, `lane/auth/email-otp`, `lane/messaging/email-templates`.

## Still on origin, merged, waiting for a decision

Delete these on GitHub once `integration/ui-redesign` is pushed, so their commits are safe on origin first.

| Branch                                    |
| ----------------------------------------- |
| `lane/admin-app/redesign`                 |
| `lane/admin-app/session-screen`           |
| `lane/console/redesign`                   |
| `lane/platform/go-live`                   |
| `lane/renderer/quranic-circles-template`  |
| `lane/user-app/session-hide-placeholders` |
| `lane/ui/member-journey`                  |
| `lane/ui/member-quran`                    |
| `lane/ui/member-redesign`                 |
| `lane/ui/session-screens`                 |

## Keep: commits not in `integration/ui-redesign`

`lane/data/tanzeem-seed`, `lane/docs/public-docs`, `lane/messaging/email-templates-bundle`, `lane/repo/tidy`, `lane/ui/design-fidelity`, `lane/web/store-pages`, `release/member-redesign`, `release/store-pages-and-tools`.

Long-lived: `main`, `integration/ui-redesign`, `release-now`.

If a branch was squash-merged, the script still calls it unmerged. Check with `git log origin/main..<branch>` and `git diff origin/main...<branch> --stat` before deleting it.

## Worktrees

Parallel worktrees live in sibling `qc-*` folders (see [worktrees](../agents/worktrees.md)). Remove one with `git worktree remove <path>` only when `git -C <path> status` is clean. `git worktree prune` drops the bookkeeping for folders that no longer exist; it deletes no branches and no files.
