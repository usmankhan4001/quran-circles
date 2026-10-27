# AGENTS.md

Entry point for any coding agent or developer in this repository, whatever the tool. [`CLAUDE.md`](CLAUDE.md) is the authority: if the two differ, `CLAUDE.md` wins. A `CLAUDE.md` inside a directory adds that lane's local rules; read it before you edit there. Where this file says "change" and `CLAUDE.md` says "pull request", see "Release line".

## What this is

Quran Circles V2, for Tanzeem-e-Islami: a pnpm monorepo (Node 22, pnpm 10.28 through Corepack, Postgres 17). It holds the API, worker, poster renderer, Expo user and admin apps and a React console, in English and Urdu (right to left). V1 is a separate repository (`usmankhan4001/nearby-dora-quran`) and is off limits. This repository is public.

The Postgres version is 17 in the dev compose file and in the production image ([`docs/getting-started.md`](docs/getting-started.md)). The CI e2e job still starts Postgres 16.

## Read in this order

1. This file, then the `CLAUDE.md` in the directory you will edit.
2. Your lane's brief: `docs/agents/briefs/<lane>.md`. No brief? Work from `docs/agents/status/<lane>.md` and ask the orchestrator before you write one.
3. Your lane's status file: `docs/agents/status/<lane>.md`. Read "In progress" and the newest dated section, and "Next step" if the file has one. Older files predate the template and often have no "Next step"; if you cannot tell what to do, ask the orchestrator ([status README](docs/agents/status/README.md)).
4. [`docs/project-state.md`](docs/project-state.md): where the project stands, open decisions and issues, branch and worktree state.
5. `docs/product/decisions.md`, only if a product decision is in question. Do not re-decide one.

The lane map is in [`docs/agents/README.md`](docs/agents/README.md) and [`docs/engineering/ownership.md`](docs/engineering/ownership.md).

## Commands

Run from the repository root. Full setup: [`docs/getting-started.md`](docs/getting-started.md). The shell snippets in the docs are Bash: use Git Bash or WSL on Windows.

- `corepack enable`, then `pnpm install`.
- `pnpm check` runs typecheck, lint, tests and the format check. CI is manual, so this is the only gate: run it before you push. It does not run `pnpm env:check` (checks that every variable in the `.env.example` files is documented in `infra/ENV.md`) or `pnpm e2e`; the manual CI run does. Run `pnpm env:check` when you change an env example file.
- `pnpm --filter @qc/<package> test` runs one package, for example `@qc/api`.
- `pnpm exec prettier --write <files>` formats the files you changed. `pnpm format` formats the whole repository, so it touches files outside your lane: do not use it in a shared checkout.
- `pnpm e2e` runs the end-to-end suite. It needs a Postgres (`docker compose -f infra/docker-compose.dev.yml up -d`, then `E2E_DATABASE_URL=postgres://qc:qc@localhost:5432/qc`) and Playwright's browser, which CI installs with `pnpm --filter @qc/e2e exec playwright install --with-deps chromium`.
- Poster renderer tests need Chromium: `pnpm --filter @qc/poster-renderer exec playwright-core install --only-shell chromium`.

## Boundaries

- One owner per directory. Edit only the directories your brief lists. For anything else, write a contract change request (`docs/engineering/contracts-process.md`) and stop. A path nobody owns: ask the orchestrator.
- Shared packages (`contracts`, `db`, `ui`, `i18n`, `messaging`) change only in their own change, never as a side effect of a feature. Any lane may add its own `@qc/i18n` keys, English and Urdu together.
- Apps never import apps. Packages never import apps. Lint enforces it.
- TypeScript strict, no `any`. Validate external input with the Zod schemas in `@qc/contracts`. Every user-facing string goes through `@qc/i18n`. Every screen works left to right and right to left, at four text sizes, light and dark.

## Never

- Put secrets, tokens, passwords, keys or real personal data in code, tests, fixtures, logs or docs. Use synthetic data. Never log phone numbers, names or message bodies.
- Use `@supabase/*`, `@neondatabase/*` or OneSignal. V2 talks to plain Postgres through the API only.
- Skip, disable or delete a test to make a check pass.
- Push to `main`, force-push, or rewrite history others have pulled. Lane agents push only `lane/<lane>/<topic>` branches.
- Deploy, or touch servers and hosting consoles (Dokploy, Proxmox, cloud). Only the orchestrator or the owner does.
- Run `git worktree prune`, `git gc`, `git prune`, `git clean -fdx` or `git reflog expire`; delete anything under `.git/worktrees/`; delete, move or "recover" a `qc-*` folder you did not create. Only the orchestrator removes stale worktree entries, after a dry run ([worktrees](docs/agents/worktrees.md)).

## Release line

The default branch is `main`. Cut your branch from the line the orchestrator names (`main` unless told otherwise; long-lived branches are listed in `docs/engineering/branch-inventory.md`). Only the orchestrator or the owner merges to `main`. Treat every push to `main` as a release.

Dokploy pulls `main` with auto-deploy on (confirmed by the owner on 2026-10-26), so every push to `main` deploys. Production is served at `qurancircles.doraquran.pk`. Lane agents never push to `main`, deploy, or use Dokploy, Proxmox or cloud tools; only the owner or orchestrator does. CI (`.github/workflows/ci.yml`) is manual and never deploys, so run `pnpm check` yourself before you ask for a merge.

Open a GitHub pull request only when the owner or orchestrator asks ([`CONTRIBUTING.md`](CONTRIBUTING.md)). Keep each change small, on its own lane branch.

## Windows and worktree hazards

Detail and recovery steps: [`docs/agents/worktrees.md`](docs/agents/worktrees.md).

- One working copy per agent, as a sibling folder `../qc-<lane>-<topic>`, never inside the repository. The live list is `git worktree list --porcelain`; `docs/agents/status/orchestrator.md` is not kept current.
- A worktree made on Windows is used only from Windows. Do not open it from WSL or a Linux sandbox: the paths in its `.git` files do not translate. As of 2026-10-26 the main clone lists a worktree at a Linux sandbox path (`/sessions/.../play-readiness`, branch `lane/release/play-readiness`) marked `prunable`.
- Registrations go missing. As of 2026-10-26 `git worktree list` showed 3 entries, while 10 sibling folders had a `.git` file pointing at a `.git/worktrees/<name>` that no longer exists. The cause is not confirmed. Do not run `prune`. Recovery (by the folder's owner or the orchestrator) is in worktrees.md.
- `.gitattributes` keeps files LF, but a Windows checkout can still look fully modified. Check `git diff --ignore-cr-at-eol --stat`; if it prints nothing, the changes are line endings only, so change nothing. Do not use `-w`: it also hides real indentation and trailing-space changes. Never commit line-ending-only changes. Write files with LF.
- A `.lock` file error means a git process may still be running. Follow "Stuck git" in worktrees.md before you delete anything.

## Finishing a session

1. Run `pnpm check`. If it fails, say exactly what fails and why.
2. Update `docs/agents/status/<lane>.md` last, in the same commit as the work: done, in progress, blocked, worktree path, next step, questions. Create the file if it is missing ([`docs/agents/status/README.md`](docs/agents/status/README.md)).
3. Remove a worktree only when it is clean and its work is committed. Set `Worktree: none` in your status file. The orchestrator checks `git worktree list --porcelain`.
4. Stop. The orchestrator assigns the next step.
