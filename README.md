# Quran Circles

Quran Circles helps people in Pakistan find the nearest Quran session, register in a tap and never miss it, and lets coordinators run a venue or circle from their phone. It covers both Dora (the Ramadan and seasonal programme) and Circles (year-round study groups), in English and Urdu.

This repository holds the whole V2 platform: one Postgres database, one API, background workers, a poster renderer, a user app (iOS, Android and PWA), an admin app for coordinators and a web console for admins. V1 (the current Nearby Dora Quran web app) lives in its own repository, `usmankhan4001/nearby-dora-quran`, and stays live until Wave 6 retires it. This repository was split out of V1's `v2/` folder with its history kept.

## Status

The build runs in waves (0 to 7) with a quality gate between each. Waves 0 to 4 are built: contracts, every app and service, end-to-end tests and the Wave 4 features (posters, ayah of the day, session companion). **Wave 5, hardening, is in progress**: security review fixes, load tests, low-end phone budgets, accessibility and a restore drill. Staging runs at `staging.doraquran.pk`. Production has not been deployed.

The live picture is in [`docs/agents/status/`](docs/agents/status/), one file per lane, with gate sign-offs in [`orchestrator.md`](docs/agents/status/orchestrator.md).

## What is in it

```mermaid
flowchart LR
  subgraph Clients
    UA[User app<br/>iOS, Android, PWA]
    AA[Admin app<br/>coordinators]
    CO[Console<br/>admins, web]
  end
  Caddy[Caddy<br/>TLS and static files]
  API[API<br/>Hono]
  W[Worker<br/>reminders, push, WhatsApp]
  PR[Poster renderer<br/>headless Chromium]
  DB[(Postgres<br/>data and pg-boss queues)]
  Meta[WhatsApp Cloud API]
  Push[FCM, APNs, web push]

  UA --> Caddy
  AA --> Caddy
  CO --> Caddy
  Caddy -->|/api| API
  Caddy -->|/webhooks/whatsapp| W
  API --> DB
  W --> DB
  W --> PR
  W --> Meta
  W --> Push
```

| Path                   | What it is                                                                | Lane                             |
| ---------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `apps/api`             | HTTP API (Hono, TypeScript)                                               | api-core, auth-scopes            |
| `apps/worker`          | Background jobs: reminders, push, WhatsApp, poster renders, daily top-ups | messaging                        |
| `apps/poster-renderer` | Renders session posters and share cards, Urdu in Nastaliq                 | renderer                         |
| `apps/user-app`        | Expo user app (iOS, Android, PWA)                                         | user-app                         |
| `apps/admin-app`       | Expo admin and coordinator app                                            | admin-app                        |
| `apps/console`         | React web console for admins (Vite)                                       | console                          |
| `packages/contracts`   | Zod schemas, API contract, OpenAPI, scope matrix, message formats, mock   | contracts                        |
| `packages/db`          | Drizzle schema, SQL migrations, seed and admin bootstrap                  | contracts                        |
| `packages/ui`          | Design tokens, the shared component kit and bundled fonts                 | ui                               |
| `packages/i18n`        | English and Urdu wording for every screen                                 | every lane adds keys; ui reviews |
| `packages/messaging`   | Provider interfaces and fakes for push, WhatsApp and SMS; outbox drafts   | messaging                        |
| `packages/content`     | Quran reader, prayer times, Hijri date, bookmarks and reading progress    | content                          |
| `tools/migration`      | One-off V1 to V2 data migration                                           | data-migration                   |
| `tests/e2e`            | End-to-end tests against a real API, worker and Postgres (Playwright)     | integration                      |
| `tests/load`           | Scope matrix runner and load tests                                        | quality                          |
| `infra`                | Docker Compose, Caddy, backups, deploy scripts, monitoring                | platform                         |
| `showcase`             | A static page that shows the screens for review                           | orchestrator                     |
| `docs`                 | Product decisions, engineering rules, design, agent briefs and status     | orchestrator                     |

Each app and package has its own short `README.md`.

## Quick start

You need Node 22 (see `.nvmrc`), pnpm through Corepack, and Docker for the local database.

```sh
corepack enable
pnpm install
pnpm check                                              # typecheck, lint, tests, format check
```

To run the apps against the contract's mock API, with no database:

```sh
pnpm --filter @qc/user-app mock                          # mock API on http://localhost:4010
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/user-app web
pnpm --filter @qc/console dev                            # proxies to the mock by default
```

To run the real API on a local Postgres, see [Getting started](docs/getting-started.md).

## Common commands

| Command                            | What it does                                                       |
| ---------------------------------- | ------------------------------------------------------------------ |
| `pnpm check`                       | Typecheck, lint, unit tests and format check                       |
| `pnpm test`                        | Unit tests in every package (not end-to-end)                       |
| `pnpm e2e`                         | End-to-end suite (starts its own stack)                            |
| `pnpm format`                      | Fix formatting with Prettier                                       |
| `pnpm --filter <package> <script>` | Run one package's script, for example `pnpm --filter @qc/api test` |

## Documentation

Start with the [documentation index](docs/README.md). The most useful pages for someone new:

- [Getting started](docs/getting-started.md): set up, run each app, run the tests.
- [Architecture](docs/architecture.md): how the parts fit together and why.
- [Deployment](docs/deployment.md): staging, production and backups.
- [Contributing](CONTRIBUTING.md): lanes, ownership, branches and the checks a change must pass.
- [Product decisions](docs/product/decisions.md): what is being built. Do not re-decide these.
- [Credits and licences](docs/credits-and-licences.md): fonts, the Quran text and the translations.

## Credits

The apps bundle Figtree (SIL OFL 1.1), Mehr Nastaliq Web (CC BY-SA 4.0) and KFGQPC Uthmanic Script HAFS (KFGQPC free-use licence, unmodified). The Arabic Quran text comes from the Tanzil Project (CC BY 3.0) and the Urdu and English translations are by Sayyid Abul A'la Maududi, via Tanzil, for non-commercial use. Details are in [Credits and licences](docs/credits-and-licences.md).

## Licence

Proprietary. The Quran Circles code belongs to Tanzeem-e-Islami, all rights reserved; it is not open source and may not be copied, used or distributed without written permission. See [`LICENSE`](LICENSE). The bundled fonts and texts keep their own licences.
