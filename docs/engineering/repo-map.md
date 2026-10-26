# Repository map

Where everything is, who owns it and how to test it. Checked against the folders on 2026-10-26. The reasons behind the structure are in [architecture.md](../architecture.md); the lane rules are in [ownership.md](ownership.md), which wins if the two disagree. Lanes that `ownership.md` does not list yet (repo, docs and others) are described in [`docs/agents/README.md`](../agents/README.md).

Every command runs from the repository root. `pnpm --filter @qc/<name> test` runs one package's tests; `pnpm check` runs typecheck, lint, every package's tests and the format check.

## The tree

```text
quran-circles/
├── apps/                   Things that run
│   ├── api/                HTTP API (Hono on Node)
│   ├── worker/             Background jobs, outgoing messages, WhatsApp webhook
│   ├── poster-renderer/    Renders session posters in headless Chromium
│   ├── user-app/           Expo app for attendees: iOS, Android, PWA
│   ├── admin-app/          Expo app for coordinators
│   └── console/            React web console for admins (Vite)
├── packages/               Code shared by the apps
│   ├── contracts/          Zod schemas, API contract, scope matrix, mock server
│   ├── db/                 Drizzle schema, migrations, seed, first-admin command
│   ├── ui/                 Design tokens, component kit, fonts
│   ├── i18n/               English and Urdu wording
│   ├── messaging/          Providers for push, WhatsApp, SMS, email; email templates
│   └── content/            Quran reader, prayer times, Hijri date, bookmarks
├── tools/                  Run by hand, not deployed
│   ├── migration/          One-off V1 to V2 data migration
│   ├── circles-load/       Cleans a circles CSV into import rows
│   └── store-assets/       App icon and store screenshot generator
├── tests/                  Suites that start real services
│   ├── e2e/                Playwright against a real API, worker and Postgres
│   └── load/               Scope verification and the Ramadan-evening load test
├── infra/                  Docker Compose, Caddy, backups, deploy scripts, monitoring
├── scripts/                Repository scripts: env parity check, branch listing
├── showcase/               Wraps the UI catalog into one page for review
├── docs/                   Everything written down (index: docs/README.md)
│   └── public/             Source of the public documentation site
├── .github/                CODEOWNERS, pull request template, issue templates, CI workflow
└── (root files)            Workspace and tool configuration, see below
```

## Apps

| Path                   | What it is                                                                                                                                                                | Owner lane                                 | Test                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `apps/api`             | The only way the apps reach the data. One folder per area in `src/modules/`, sign-in in `src/auth/`                                                                       | api-core; auth-scopes for the sign-in code | `pnpm --filter @qc/api test`                                       |
| `apps/worker`          | pg-boss jobs: reminders, push, WhatsApp and SMS, poster renders, daily top-up, sign-in cleanup                                                                            | messaging                                  | `pnpm --filter @qc/worker test`                                    |
| `apps/poster-renderer` | Renders posters and share cards, Urdu in Nastaliq. Only the worker calls it                                                                                               | renderer                                   | `pnpm --filter @qc/poster-renderer test` (needs headless Chromium) |
| `apps/user-app`        | The attendee app: find a session, register, reminders, Quran, prayer times. Also the public store pages (`/welcome`, `/privacy`, `/terms`, `/delete-account`, `/support`) | user-app                                   | `pnpm --filter @qc/user-app test`                                  |
| `apps/admin-app`       | The coordinator app: post an update, change a time, edit a venue, attendance                                                                                              | admin-app                                  | `pnpm --filter @qc/admin-app test`                                 |
| `apps/console`         | The web console for national and city admins: sessions, venues, invites, bulk import, exports                                                                             | console                                    | `pnpm --filter @qc/console test`                                   |

Apps never import other apps. Packages never import apps. Lint enforces both.

## Packages

| Path                 | What it is                                                                                                                                    | Owner lane                               | Test                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------- |
| `packages/contracts` | The contract: schemas, endpoint registry, errors, scope matrix ([SCOPES.md](../../packages/contracts/SCOPES.md)), `openapi.json`, mock server | contracts                                | `pnpm --filter @qc/contracts test` |
| `packages/db`        | Drizzle schema, SQL migrations, synthetic seed, `bootstrap-admin`                                                                             | contracts                                | `pnpm --filter @qc/db test`        |
| `packages/ui`        | Design tokens, the component kit, bundled fonts, the static catalog                                                                           | ui                                       | `pnpm --filter @qc/ui test`        |
| `packages/i18n`      | Every user-facing string in English and Urdu, split into parts per app                                                                        | every lane adds keys; ui reviews wording | `pnpm --filter @qc/i18n test`      |
| `packages/messaging` | Provider interfaces and fakes, outbox drafts, sign-in code delivery, branded email templates (`email:previews`, `email:publish`)              | messaging                                | `pnpm --filter @qc/messaging test` |
| `packages/content`   | Quran text source and cache, prayer times, Hijri date, bookmarks, reading progress                                                            | content                                  | `pnpm --filter @qc/content test`   |

`contracts`, `db`, `ui`, `i18n` and `messaging` are shared: they change only in their own pull request (see [ownership.md](ownership.md)).

## Tools, tests and everything else

| Path                 | What it is                                                                                                                                               | Owner lane                                                                                                                                                                           | Test                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `tools/migration`    | V1 to V2 migration: export, mapping, dry run, apply, verify. Prints counts only                                                                          | data-migration                                                                                                                                                                       | `pnpm --filter @qc/migration test`                                                                            |
| `tools/circles-load` | Cleans a circles CSV passed at run time and finds one map position per venue. Never writes to a database                                                 | data (no row in `ownership.md` yet)                                                                                                                                                  | `pnpm --filter @qc/circles-load test`                                                                         |
| `tools/store-assets` | App icons and store screenshots. Not a workspace package (no `package.json`)                                                                             | release                                                                                                                                                                              | None. Run by hand, see its README                                                                             |
| `tests/e2e`          | Playwright flows for the API, the PWA, the console and the admin app, on a real stack                                                                    | integration                                                                                                                                                                          | `pnpm e2e` (needs a Postgres, see [getting started](../getting-started.md#tests-and-other-checks))            |
| `tests/load`         | Scope verification against the matrix and the evening load scenario                                                                                      | quality                                                                                                                                                                              | `pnpm --filter @qc/load test` (fast self-check); `pnpm --filter @qc/load local` for the real run              |
| `infra`              | Compose files for dev, staging and production (including the Dokploy production override), Caddy, Postgres roles, backups, cron, monitoring, `deploy.sh` | platform                                                                                                                                                                             | `pnpm env:check` checks `.env.example` against `infra/ENV.md`; the shell scripts are run by hand              |
| `scripts`            | `check-env-parity.mjs` (behind `pnpm env:check`) and `branch-cleanup.sh` (behind `pnpm branches`, list only by default)                                  | platform (`ownership.md` and `CODEOWNERS`); the repo lane also lists `scripts/`                                                                                                      | `pnpm env:check`                                                                                              |
| `showcase`           | Builds one reviewable page from the `@qc/ui` catalog. Not a workspace package                                                                            | no lane (ask the orchestrator)                                                                                                                                                       | None. `pnpm --filter @qc/ui catalog` then `node showcase/build.mjs`                                           |
| `docs`               | Product decisions, engineering rules, design, release and agent files                                                                                    | By folder: `design/` ui; `security/` quality; `release/` release; `engineering/i18n-keys.md` contracts; `public/` docs lane. `quality/` and the rest: no lane (ask the orchestrator) | `pnpm format:check`                                                                                           |
| `docs/public`        | The public documentation site: Markdown in `content/en` and `content/ur`, a zero-dependency generator, screenshots                                       | docs (no row in `ownership.md` yet)                                                                                                                                                  | `node docs/public/build.mjs --out <folder>` fails on a broken link, a missing image or a page without a title |
| `.github`            | `CODEOWNERS`, `pull_request_template.md`, `ISSUE_TEMPLATE/`, `dependabot.yml`, `workflows/ci.yml`                                                        | platform                                                                                                                                                                             | CI is run by hand, see [Contributing](../../CONTRIBUTING.md#ci)                                               |

The pnpm workspace (`pnpm-workspace.yaml`) is `apps/*`, `packages/*`, `tools/*` and `tests/*`. A folder in one of those without a `package.json` (today: `tools/store-assets`) is not a package.

## Root files

| File                                                                                             | What it is                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md`                                                    | What this is, the contribution rules, how to report a vulnerability                                                                                |
| `AGENTS.md`                                                                                      | Entry point for any coding agent or developer: reading order, commands, release line, Windows worktree hazards. `CLAUDE.md` wins if the two differ |
| `CLAUDE.md`                                                                                      | The rules every agent follows. Most apps and packages have their own short `CLAUDE.md` too                                                         |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`                                          | Root scripts (`check`, `test`, `e2e`, `format`, `env:check`, `branches`), workspace globs, lockfile                                                |
| `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig` | Shared TypeScript, lint and format settings                                                                                                        |
| `.nvmrc`, `.npmrc`                                                                               | Node major version (22); `engine-strict=true`, so pnpm refuses an unsupported Node                                                                 |
| `.gitattributes`, `.gitignore`                                                                   | LF line endings; what git ignores                                                                                                                  |
| `.env.example`                                                                                   | Development-only environment template. The server template is `infra/.env.example`                                                                 |
| `LICENSE`                                                                                        | Copyright notice: all rights reserved, Tanzeem-e-Islami                                                                                            |

Platform owns the configuration files, `CLAUDE.md` and `SECURITY.md` (`.github/CODEOWNERS` lists them). `AGENTS.md` is an agent entry doc, which `docs/agents/README.md` gives to the repo lane; `CODEOWNERS` does not list it yet. `ownership.md` has no row for `README.md`, `CONTRIBUTING.md` or `AGENTS.md`.

## Not in git

Created on your machine and ignored: `node_modules/`, `build/`, `dist/`, `coverage/`, `.expo/`, `.env` and `.env.*` (not the `.example` files), `.worktrees/`, `*.bundle`, `*.patch`, `email-previews/`, `playwright-report/`, `test-results/` and a root `ui/` folder. See `.gitignore` for the full list. Parallel agent worktrees live in sibling `qc-*` folders ([worktrees](../agents/worktrees.md)).

## Where to look next

- A feature or screen: its brief in [`docs/agents/briefs/`](../agents/briefs/), its spec in [`docs/design/screens/`](../design/screens/) and its decisions in [`decisions/`](decisions/README.md).
- The data model: [`docs/product/data-model.md`](../product/data-model.md) and `packages/db/src/schema/`.
- Who may edit what: [ownership.md](ownership.md). Changing a shared contract: [contracts-process.md](contracts-process.md).
