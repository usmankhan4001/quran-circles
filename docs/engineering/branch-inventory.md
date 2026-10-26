# Branch inventory

A snapshot of the branches on 2026-10-25, compared with `origin/main` as this clone last saw it (the audit could not fetch, so refresh with `git fetch origin --prune` and re-run `pnpm branches`). Nothing was deleted.

`scripts/branch-cleanup.sh` (run as `pnpm branches`) prints this list live. It only lists by default. `--delete` removes merged branches, after you type `yes` for each batch.

## Merged into main and safe to delete after you confirm

| Branch                                    | Where                              |
| ----------------------------------------- | ---------------------------------- |
| `lane/platform/go-live`                   | local, origin                      |
| `lane/ui/member-redesign`                 | origin (local copy is also merged) |
| `lane/ui/session-screens`                 | local, origin                      |
| `lane/admin-app/session-screen`           | origin                             |
| `lane/renderer/quranic-circles-template`  | origin                             |
| `lane/user-app/session-hide-placeholders` | origin                             |

## Active (merged or not, leave alone)

`lane/ui/design-fidelity`, `lane/ui/member-journey`, `lane/ui/member-quran`, `lane/auth/email-otp`, `lane/messaging/email-templates`, `lane/messaging/email-templates-bundle`, `lane/data/tanzeem-seed`, `lane/console/redesign`, `lane/admin-app/redesign`, `release/store-pages-and-tools`, `integration/ui-redesign`, `release-now` (local, your current checkout), `lane/repo/tidy`.

## Not merged, needs a decision

| Branch                    | Commits not in main | Note                                           |
| ------------------------- | ------------------- | ---------------------------------------------- |
| `lane/docs/public-docs`   | 2                   | Has a Windows worktree at `qc-public-docs`     |
| `lane/web/store-pages`    | 1                   | Has a Windows worktree at `qc-web-store-pages` |
| `release/member-redesign` | 4                   | Has a Windows worktree at `qc-redesign`        |

If any of these were squash-merged, the script still calls them unmerged. Check with `git log origin/main..<branch>` and `git diff origin/main...<branch> --stat` before deleting.

## Stale worktrees

`git worktree list` shows 11 worktrees under `D:/Apps/CSG Venture/USMAN/qc-*` marked `prunable` when the audit ran from a Linux sandbox that cannot see `D:` paths. Run `git worktree list` in Windows first: only worktrees whose folders are really gone should be pruned. `git worktree prune` removes the bookkeeping only; it deletes no branches and no files. Two worktrees under `.worktrees/` (`email-otp`, `email-templates`) are locked by other sessions and are left alone.
