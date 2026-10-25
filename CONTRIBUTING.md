# Contributing

Quran Circles is built by a small team of people and Claude agents working in parallel. The rules below keep that from turning into conflicts. They apply to humans and agents alike.

## Before you start

1. Set up the repository with [Getting started](docs/getting-started.md) and make sure `pnpm check` passes.
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

- **Small changes.** One work package, or part of one, per change.
- **Tests with the code**, including the failure paths. Scope and authorisation code needs a test for every role.
- **TypeScript strict**, no `any`. Validate every external input with the Zod schemas in `@qc/contracts`.
- **Every user-facing string** goes through `@qc/i18n`, English and Urdu added together. Urdu you write is a draft until a native speaker reviews it; keep the review marker.
- **Every screen** works left to right and right to left, at all four text sizes, in light and dark. Use logical properties (`marginStart`, `paddingEnd`), never `left` or `right`.
- **Run `pnpm check`** before you push. Run `pnpm format` if the format check fails.
- **Environment variables** go in `.env.example` or `infra/.env.example` and in `infra/ENV.md` together; `pnpm env:check` verifies they agree.
- **Update your lane's status file** (`docs/agents/status/<lane>.md`) with what you did, what is in progress, what is blocked and any questions.

## Never

- No secrets, tokens, passwords, keys or real personal data in code, tests, fixtures, logs or docs. Use fakes and synthetic data.
- No logging of phone numbers, names or message bodies.
- No skipped, disabled or deleted tests to make a check pass.
- No `@supabase/*`, `@neondatabase/*` or OneSignal.
- Do not modify the KFGQPC Quran font file, and do not commit Quran text or translations ([credits and licences](docs/credits-and-licences.md)).

## Branches, commits and review

The full rules are in [`docs/engineering/branches-and-review.md`](docs/engineering/branches-and-review.md). In short:

- Lane branches are named `lane/<lane>/<topic>`.
- Commit messages start with the lane or area: `<lane>: <what changed> (WP<n>)`, for example `api-core: add venue list endpoint (WP2)`.
- Pull requests use [`.github/pull_request_template.md`](.github/pull_request_template.md). A reviewer who did not write the change approves it.
- Sensitive areas need a human approval: sign-in, scope checks, migrations, WhatsApp, account deletion, infrastructure and anything that stores personal data. [`.github/CODEOWNERS`](.github/CODEOWNERS) lists the paths.

**`main` deploys production.** Dokploy pulls `main` from GitHub with auto-deploy on, so a push to `main` goes live. Push your work to your lane branch, and merge to `main` only when it is meant to go live. Checks run locally with `pnpm check`; the CI workflow is manual only (Actions > ci > Run workflow), so pushes start no runs. Do not open pull requests unless the owner asks. Branch protection for `main` is a checklist in [`docs/engineering/github-settings.md`](docs/engineering/github-settings.md).

Branch names and line endings: use lowercase `lane/<lane>/<topic>` (or `release/<name>`), and let `.gitattributes` keep files LF, whatever your `core.autocrlf` is. To see which old branches are merged, run `pnpm branches` (list only).

## Architecture decisions

A choice that is hard to undo (a new library, a new service, a change to how something is stored) gets a decision record in [`docs/engineering/decisions/`](docs/engineering/decisions/README.md), numbered in order. Read the existing ones first; they explain most of what may look surprising in the code.

## Agents

Claude agents also read [`CLAUDE.md`](CLAUDE.md) and the `CLAUDE.md` in the directory they work in, then [`docs/agents/README.md`](docs/agents/README.md) for how lanes, worktrees and handoffs work.
