# Contributing

Quran Circles is built by a small team of people and Claude agents working in parallel. The rules below keep that from turning into conflicts. They apply to humans and agents alike.

## The short version

1. Work on a branch named `lane/<lane>/<topic>`. Never commit or push to `main`: Dokploy is recorded as deploying `main`, so treat every push as a release ([Branches and releases](#branches-and-releases)).
2. Edit only the directories your lane owns ([`docs/engineering/ownership.md`](docs/engineering/ownership.md)).
3. Keep each change small: one work package, or part of one.
4. Run `pnpm check` before you push. It must pass.
5. Update your lane's status file in `docs/agents/status/`.

## Before you start

1. Set up the repository with [Getting started](docs/getting-started.md) and make sure `pnpm check` passes. The folders are explained in the [repository map](docs/engineering/repo-map.md).
2. Read [`docs/product/decisions.md`](docs/product/decisions.md). Product decisions are settled; raise a question instead of re-deciding one.
3. Find the lane that owns what you want to change in [`docs/engineering/ownership.md`](docs/engineering/ownership.md), and read that lane's brief in [`docs/agents/briefs/`](docs/agents/briefs/).
4. Check the lane's status file in [`docs/agents/status/`](docs/agents/status/) for work already in progress.

## Lanes and ownership

The work is split into **lanes**. Each lane owns a set of directories and a set of numbered **work packages** (WP1, WP2, ...), and the build moves through **waves** with a quality gate between each ([`docs/engineering/gates.md`](docs/engineering/gates.md)).

- One owner per directory. Edit only the directories your lane owns.
- If you need a change somewhere else, write a contract change request ([`docs/engineering/contracts-process.md`](docs/engineering/contracts-process.md)) in `docs/engineering/change-requests/` and stop the work that depends on it.
- The shared packages (`contracts`, `db`, `ui`, `i18n`, `messaging`) change only in their own pull request, never as a side effect of a feature. The one exception: any lane adds its own `@qc/i18n` keys, English and Urdu together, with the screen that uses them.
- The UI lane (WP21) owns the component kit, the design tokens and `docs/design/`. Front-end work follows its rules: [right-to-left Urdu guide](docs/design/rtl-urdu-guide.md), [accessibility](docs/design/accessibility.md) and [microcopy](docs/design/microcopy.md).

## Making a change

- **Small changes.** One work package, or part of one, per branch and per pull request.
- **Tests with the code**, including the failure paths. Scope and authorisation code needs a test for every role.
- **TypeScript strict**, no `any`. Validate every external input with the Zod schemas in `@qc/contracts`.
- **Every user-facing string** goes through `@qc/i18n`, English and Urdu added together. Urdu you write is a draft until a native speaker reviews it; keep the review marker.
- **Every screen** works left to right and right to left, at all four text sizes, in light and dark. Use logical properties (`marginStart`, `paddingEnd`), never `left` or `right`.
- **Run `pnpm check`** before you push. It runs typecheck, lint, every package's unit tests and the format check. Run `pnpm format` if the format check fails. It does not run the end-to-end suite (`pnpm e2e`), which starts real services.
- **Environment variables** go in `.env.example` or `infra/.env.example` and in `infra/ENV.md` together; `pnpm env:check` verifies they agree.
- **Update your lane's status file** (`docs/agents/status/<lane>.md`) with what you did, what is in progress, what is blocked and any questions.

## Never

- No secrets, tokens, passwords, keys or real personal data in code, tests, fixtures, logs or docs. Use fakes and synthetic data.
- No logging of phone numbers, names or message bodies.
- No skipped, disabled or deleted tests to make a check pass.
- No `@supabase/*`, `@neondatabase/*` or OneSignal.
- Do not modify the KFGQPC Quran font file, and do not commit Quran text or translations ([credits and licences](docs/credits-and-licences.md)).

## Branches and releases

The full rules are in [`docs/engineering/branches-and-review.md`](docs/engineering/branches-and-review.md).

**Treat every push to `main` as a release.** [`docs/deployment.md`](docs/deployment.md) records that Dokploy pulls `main` from GitHub with auto-deploy on, whether or not CI has finished. [`docs/handoff.md`](docs/handoff.md) instead describes deploying staging by hand in Dokploy after a push, and [`docs/release/go-live.md`](docs/release/go-live.md) plans production with auto-deploy off. Which setting is live is unconfirmed (see "Release line" in [`AGENTS.md`](AGENTS.md#release-line)), and no production server exists yet.

- **Never commit or push directly to `main`.** Only the owner merges to `main`, and only when the work is meant to go live.
- **Lane branches** are named `lane/<lane>/<topic>`, lowercase, one topic per branch, for example `lane/api-core/venues`. Release branches are `release/<name>`.
- **Integration branch.** The orchestrator names the branch a wave merges into; agents never push to it directly. [`docs/engineering/branch-inventory.md`](docs/engineering/branch-inventory.md) lists the long-lived branches and which others are merged.
- **Pull requests.** A change reaches an integration branch or `main` through a small pull request that uses [`.github/pull_request_template.md`](.github/pull_request_template.md). Agents open a pull request when the owner or orchestrator asks for one; they never merge it. A reviewer who did not write the change approves it, and the orchestrator or owner squash-merges it.
- **Commit messages** start with the lane or area: `<lane>: <what changed> (WP<n>)`, for example `api-core: add venue list endpoint (WP2)`.
- **Sensitive areas** need a human approval: sign-in, scope checks, migrations, WhatsApp, account deletion, infrastructure and anything that stores personal data. [`.github/CODEOWNERS`](.github/CODEOWNERS) lists the paths.
- **After a merge, delete the branch** and remove its worktree. `pnpm branches` lists which branches are merged into `origin/main` and changes nothing; squash-merged branches show as unmerged, so check those by hand.
- **Branch protection** for `main` is a checklist in [`docs/engineering/github-settings.md`](docs/engineering/github-settings.md). Until it is on, nothing but the rules above stops a bad push.

### CI

The CI workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) is manual: start it from the repository's Actions tab (ci > Run workflow). Pushes and pull requests start no run, so run `pnpm check` yourself before you push. A manual run has two jobs. `check` runs the format check, `pnpm env:check`, typecheck, lint and the unit tests. `e2e` runs `pnpm e2e` against a Postgres service and is advisory (it does not fail the run). CI never deploys; deploys happen in Dokploy.

### Worktrees

Each agent works in its own git worktree on its own lane branch, so two agents never share a working copy. Put worktrees in sibling folders named `qc-<lane>-<topic>`, cut from `origin/main` unless the orchestrator names another line:

```sh
git fetch origin
git config core.autocrlf false
git worktree add --no-track ../qc-api-core-venues -b lane/api-core/venues origin/main
cd ../qc-api-core-venues && pnpm install
```

`--no-track` keeps the new branch from tracking `origin/main`. Remove the worktree and the branch when the work has merged (`git worktree remove ../qc-api-core-venues`, then `git branch -d lane/api-core/venues`). Never run `git worktree prune`, `git gc` or the other commands listed under "Never run these" in [`docs/agents/worktrees.md`](docs/agents/worktrees.md#never-run-these).

### Line endings on Windows

Everything in the repository is stored with LF. [`.gitattributes`](.gitattributes) keeps files LF on checkout whatever your `core.autocrlf` setting is, so do not convert them. If an older clone shows hundreds of files changed by `pnpm format:check`, run `git add --renormalize . && git status`, or clone again. Windows-only scripts (`.bat`, `.cmd`, `.ps1`) are the exception and keep CRLF; there are none today.

## Architecture decisions

A choice that is hard to undo (a new library, a new service, a change to how something is stored) gets a decision record in [`docs/engineering/decisions/`](docs/engineering/decisions/README.md), numbered in order. Read the existing ones first; they explain most of what may look surprising in the code.

## Agents

Agents start at [`AGENTS.md`](AGENTS.md), the entry point for any coding agent or developer. Claude agents also read [`CLAUDE.md`](CLAUDE.md) (the authority if the two differ) and the `CLAUDE.md` in the directory they work in, if it has one, then [`docs/agents/README.md`](docs/agents/README.md) for how lanes, worktrees and handoffs work. Ownership is in [`docs/engineering/ownership.md`](docs/engineering/ownership.md).
