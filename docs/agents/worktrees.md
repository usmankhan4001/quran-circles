# Running agents in parallel with git worktrees

Each agent gets its own working copy and branch, so agents never overwrite each other.

**Integration line:** cut lane branches from `origin/main` unless the orchestrator names another line. The long-lived branches are `main`, `integration/ui-redesign` and `release-now` ([branch inventory](../engineering/branch-inventory.md)). Agents push only to their own lane branch (see [branches and review](../engineering/branches-and-review.md)).

## Where worktrees go

- A sibling folder of the main clone, named `../qc-<lane>-<topic>`, on the same drive. Example: branch `lane/api-core/venues` in `../qc-api-core-venues`.
- Never inside the repository. `.worktrees/` is in `.gitignore`, but `eslint.config.js` does not skip it, so lint would read every copy in it. Do not use that folder.
- Each worktree belongs to one operating system: the one that created it (see Hazards).

## Create one

Run from the main clone.

```sh
git worktree list                     # see what already exists
git fetch origin
git config core.autocrlf false        # stored in the main clone, shared by every worktree
git worktree add --no-track ../qc-api-core-venues -b lane/api-core/venues origin/main
cd ../qc-api-core-venues
pnpm install
```

`--no-track` keeps the new branch from tracking `origin/main`. Then give the agent the standard prompt from [`README.md`](README.md) and write the folder path in the `Worktree:` line of its status file.

## Rules

- One worktree and one branch per agent. Never run two agents in the same worktree.
- V1 lives in its own repository (`usmankhan4001/nearby-dora-quran`) and is off limits to agents.
- `pnpm install` is fast after the first run because pnpm shares its store across worktrees.
- The source of truth for open worktrees is `git worktree list --porcelain`. The "Open worktrees" section of `status/orchestrator.md` was last written before the lane branches existed and is not kept current; do not rely on it. Set `Worktree:` in your own status file and set it to `none` when you remove the folder.
- Start order is the orchestrator's call. When the contracts or the ui kit change, those lanes go first and the others rebase onto them.

## Remove one

A branch keeps all committed work, so removing the folder loses only what is not committed. Check first:

```sh
git -C ../qc-api-core-venues status --short     # must print nothing
git worktree remove ../qc-api-core-venues       # refuses if tracked files changed or untracked files exist
git branch -d lane/api-core/venues              # refuses if the branch is not merged
```

- `git worktree remove` does not warn about ignored files. `.env` and `node_modules` are deleted with the folder, so copy out anything you need.
- Never add `--force` to `remove` or `-D` to `branch` to get past a refusal. Ask the orchestrator.
- A locked worktree must be unlocked first: `git worktree unlock <path>`.
- To see which old branches are merged, run `pnpm branches` (it only lists).

## Hazards

### Never run these

`git worktree prune`, `git gc`, `git prune`, `git clean -fdx`, `git reflog expire`, `git update-ref -d`, and anything that deletes `.git/worktrees/`. All worktrees share one `.git` folder. `git worktree prune` forgets every worktree whose folder it cannot find, and a process that cannot see the drive finds none of them. Read-only checks are fine: `git worktree list --porcelain` (look for `prunable`) and `git worktree prune --dry-run`.

These bans apply to every agent. Only the orchestrator clears a stale entry: run `git worktree prune --dry-run`, read every line it would remove, and run `git worktree prune` only if the list holds nothing but entries you expect to lose. Folders that other agents own are never moved or deleted by anyone else (see "Lost registrations" for who recovers one).

To protect a long-lived worktree from a prune, lock it: `git worktree lock --reason 'windows checkout' <path>`. A locked worktree survives `prune`.

### One operating system per worktree

A worktree made on Windows (`D:/...`) is used only from Windows. Its `.git` file and the registration inside the main clone store absolute paths, and those do not translate to WSL or a Linux sandbox. If a sandbox must read the repository, mount it read-only and do not run git writes there. A Linux checkout needs its own clone.

The reverse already happened. On 2026-10-26 `git worktree list --porcelain` in the main clone showed a worktree at a Linux sandbox path (`/sessions/rcw-.../mnt/quran-circles/.worktrees/play-readiness`, branch `lane/release/play-readiness`) marked `prunable: gitdir file points to non-existent location`. Windows cannot see that path, so the entry is stale from here. Leave it for the orchestrator to clear (see "Never run these"). The branch and its commits are not affected. Whether this sandbox is what removed the other registrations is not confirmed.

### Lost registrations

State on 2026-10-26, from the main clone: `git worktree list` showed 3 entries (the main clone, the `prunable` sandbox entry above, and `qc-integrate`). Ten sibling folders held a `.git` file that named `.git/worktrees/<name>` in the main clone, where that folder was gone. Four more (`qc-console-redesign`, `qc-coordinator-redesign`, `qc-member-journey`, `qc-member-quran`) have no `.git` entry at all and hold only `apps`, `packages`, `tests`, `tools` and `node_modules`: they are not worktrees. The cause is not confirmed. Re-run `git worktree list --porcelain` before you act on this page; the state may have changed.

You recognise it like this:

```sh
cd ../qc-foo && git status        # fatal: not a git repository
cat .git                          # gitdir: .../quran-circles/.git/worktrees/qc-foo
ls <main clone>/.git/worktrees    # no qc-foo
```

The branch and its commits are safe, because branches are not stored in that folder.

**Who recovers.** The agent that owns the folder, or the orchestrator. Nobody else moves or deletes a `qc-*` folder. The ban in `AGENTS.md` is on touching another agent's folder, not on recovering your own.

**Which branch.** The folder does not record its branch, so the branch cannot be read from it. The table lists the existing branch whose name matches the folder name. It is a candidate, not a verified mapping: confirm with the folder's owner or the orchestrator, and check `git log` on the branch against what the folder held.

| Folder                 | Candidate branch (matched by name only)                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `qc-design-fidelity`   | `lane/ui/design-fidelity`                                                                    |
| `qc-design-fidelity-b` | none by name; ask                                                                            |
| `qc-email-otp-wt`      | `lane/auth/email-otp`                                                                        |
| `qc-email-templates`   | `lane/messaging/email-templates-bundle` (local); origin has `lane/messaging/email-templates` |
| `qc-integration`       | none by name; ask                                                                            |
| `qc-public-docs`       | `lane/docs/public-docs`                                                                      |
| `qc-redesign`          | none by name; `integration/ui-redesign` is the nearest branch, ask                           |
| `qc-repo-polish`       | `lane/repo/polish`                                                                           |
| `qc-tanzeem-seed`      | `lane/data/tanzeem-seed`                                                                     |
| `qc-web-store-pages`   | `lane/web/store-pages`                                                                       |

**Recovery.** This worked on 2026-10-26 on a Windows checkout:

```sh
git branch --list <branch>                       # the branch must still exist
mv ../qc-foo ../qc-foo.old                       # keep the old folder: it may hold uncommitted work
git worktree add ../qc-foo <branch>              # a fresh, registered checkout of the same branch
diff -rq --exclude=node_modules --exclude=.git ../qc-foo.old ../qc-foo
```

Copy any file that exists only in `../qc-foo.old` into `../qc-foo`, run `pnpm install`, and delete `../qc-foo.old` only when the diff is clean and the owner agrees. If you do not know the branch, ask the orchestrator. `../_qc-worktree-backup-20261026` holds folders with eight of the names above (all except `qc-design-fidelity-b` and `qc-email-otp-wt`); keep it until the recreated worktrees are verified.

Two things were seen once and not re-checked: `git worktree repair` printed "unable to locate repository", and `git worktree add --force` refused a folder that exists. They are why the `mv` step is there. Do not run `repair` or `add --force` to test them.

### Stuck git

An error like `Unable to create '.../index.lock': File exists` means git thinks another process is running. Another agent in another worktree may be.

1. Check that no git process is running: `tasklist | findstr /i git` on Windows, `pgrep -a git` elsewhere.
2. Only then delete the one `.lock` file the error names. Find them all with `find "$(git rev-parse --git-common-dir)" -name '*.lock'`. Typical places: `.git/worktrees/<name>/index.lock`, `.git/packed-refs.lock`, `.git/refs/heads/<lane>/<topic>.lock`.
3. Do not run `git gc` or `git prune` to clear it, and do not delete `.git/worktrees/*`.
4. If refs look corrupt, stop and ask the orchestrator. Read-only diagnostics: `git worktree list --porcelain` and `git fsck --no-dangling`.

### Line endings

`.gitattributes` forces LF (`* text=auto eol=lf`), and `.editorconfig` and `.prettierrc.json` say LF. Setting `core.autocrlf false` in the main clone, before you add a worktree, keeps checkout from converting files. Editors on Windows can still write CRLF, and then every file looks modified.

- Check: `git diff --ignore-cr-at-eol --stat`. If it prints nothing, the changes are line endings only. Do not add `-w`: it also hides indentation and trailing-space changes, so an empty result could be a real reformat.
- Do not commit line-ending-only changes. Before you stage, format only your own files: `pnpm exec prettier --write <files>`. `pnpm format` runs `prettier --write .` over the whole repository and rewrites files outside your lane.

## Cloud sessions

The same flow works with cloud sessions: one session per lane, each on its own lane branch, started with the same prompt. Do not give a session production credentials.
