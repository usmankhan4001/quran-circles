# Quran Circles V2

Monorepo for the V2 platform: one Postgres database and one API, a user app, an admin app, a desktop console, and background workers. V1 (the current Nearby Dora Quran web app) stays at the repository root, unchanged and live, until Wave 6 retires it.

Status: **Wave 0 scaffold.** The workspace builds, tests run, and every lane has a written brief. No product code exists yet.

## Layout

| Path                 | What it is                                                         | Lane                                         |
| -------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `apps/api`           | Hono API                                                           | api-core, auth-scopes                        |
| `apps/worker`        | Background jobs: reminders, push, WhatsApp sends                   | messaging                                    |
| `apps/user-app`      | Expo user app (iOS, Android, PWA)                                  | user-app                                     |
| `apps/admin-app`     | Expo admin and coordinator app                                     | admin-app                                    |
| `apps/console`       | React web console for admins                                       | console                                      |
| `packages/contracts` | Zod schemas, API contract, scope matrix, message formats           | contracts                                    |
| `packages/db`        | Drizzle schema and migrations                                      | contracts                                    |
| `packages/ui`        | Design tokens and shared component kit                             | ui                                           |
| `packages/i18n`      | English and Urdu translation files                                 | every lane adds its keys; ui reviews wording |
| `packages/messaging` | Provider interfaces and fakes for push, WhatsApp, SMS              | messaging                                    |
| `packages/content`   | Quran reader and prayer-time modules                               | content                                      |
| `tools/migration`    | One-off V1 data migration scripts                                  | data-migration                               |
| `tests/e2e`          | End-to-end tests                                                   | integration                                  |
| `infra`              | Compose files, proxy template, VPS checklist                       | platform                                     |
| `docs`               | Product source pack, engineering rules, agent briefs, design notes | orchestrator                                 |

## Quick start

```sh
corepack enable
pnpm install
pnpm check            # typecheck, lint, tests, format check
docker compose -f infra/docker-compose.dev.yml up -d   # local Postgres
cp .env.example .env
pnpm --filter @qc/api dev
```

## Read first

1. `CLAUDE.md` for the rules every agent follows.
2. `docs/README.md` for the index.
3. `docs/agents/README.md`, then your lane's brief in `docs/agents/briefs/`.
