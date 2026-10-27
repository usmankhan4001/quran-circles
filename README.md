<div align="center">

<img src="docs/assets/banner.svg" alt="Quran Circles banner: the Tanzeem-e-Islami Quran Circles logo on a green background with the line 'Find your nearest Quran circle. Join in a tap.'" width="100%">

# Quran Circles

**Find the nearest Quran circle, register in a tap and never miss it. English and Urdu.**

[Web app](https://qurancircles.doraquran.pk) · [Documentation](docs/README.md) · [Member guide](docs/public/content/en/member-guide.md) · [API reference](docs/public/content/en/api-reference.md) · [Getting started](docs/getting-started.md)

![Licence: proprietary, all rights reserved](https://img.shields.io/badge/licence-proprietary-lightgrey)
![Node 22](https://img.shields.io/badge/node-22-339933)
![pnpm 10](https://img.shields.io/badge/pnpm-10-f69220)
![TypeScript, strict mode](https://img.shields.io/badge/typescript-strict-3178c6)
![English and Urdu, right to left supported](https://img.shields.io/badge/English%20%2B%20Urdu-RTL-0a6938)

</div>

Quran Circles is the platform for Tanzeem-e-Islami's Quran sessions in Pakistan. People find a session near them, join it and get reminders. Coordinators run a venue or circle from their phone. Admins oversee a city or the whole country from a web console. It covers both Dora (the Ramadan and seasonal programme) and Circles (year-round study groups).

## Start here

| I am...                                              | Go to                                                                                                                                                                                                       |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A member or a coordinator who wants to use the app   | The [member guide](docs/public/content/en/member-guide.md) or the [coordinator guide](docs/public/content/en/coordinator-guide.md). Urdu pages are in [`docs/public/content/ur/`](docs/public/content/ur/). |
| An admin using the web console                       | The [console guide](docs/public/content/en/console-guide.md)                                                                                                                                                |
| A developer who wants to run or change the code      | [Getting started](docs/getting-started.md), then the [repository map](docs/engineering/repo-map.md), [architecture](docs/architecture.md) and [Contributing](CONTRIBUTING.md)                               |
| A partner developer who wants to call the public API | The [API overview](docs/public/content/en/api-overview.md) and the [API reference](docs/public/content/en/api-reference.md)                                                                                 |
| An AI coding agent                                   | [`AGENTS.md`](AGENTS.md), then [`CLAUDE.md`](CLAUDE.md) (it wins if the two differ), your lane's brief in [`docs/agents/briefs/`](docs/agents/briefs/) and the [status files](docs/agents/status/README.md) |
| Releasing the app or deploying the servers           | The [go-live plan](docs/release/go-live.md), the [Play Console steps](docs/release/play-console.md), the [store listing](docs/release/store-listing.md) and the [deployment overview](docs/deployment.md)   |
| Someone who found a security problem                 | The [security policy](SECURITY.md). Do not open a public issue.                                                                                                                                             |

## Screenshots

The user app on a phone, from the current build. Sessions, venues and names are synthetic demo data. Home, Nearby, Session, and Quran and prayer, in English and in Urdu (right to left).

<p align="center">
  <img src="docs/assets/screenshots/en-home.png" alt="Home screen in English: a greeting, the next session card with a Confirm I will join button, and sessions near you this week" width="23%">
  <img src="docs/assets/screenshots/en-nearby.png" alt="Nearby screen in English: a search box, a Map and List switch, filter chips and a list of sessions" width="23%">
  <img src="docs/assets/screenshots/en-session.png" alt="Session screen in English: the start time, a Join button, a reminders note, today's portion and details about the circle" width="23%">
  <img src="docs/assets/screenshots/en-quran.png" alt="Quran and Prayer screen in English: a Start reading card for Al-Fatihah, a memorisation card and a list of surahs" width="23%">
</p>
<p align="center">
  <img src="docs/assets/screenshots/ur-home.png" alt="Home screen in Urdu, laid out right to left: a greeting, the next session card with a join confirmation button, and sessions near you this week" width="23%">
  <img src="docs/assets/screenshots/ur-nearby.png" alt="Nearby screen in Urdu, laid out right to left: a search box, a List and Map switch, filter chips and a list of sessions" width="23%">
  <img src="docs/assets/screenshots/ur-session.png" alt="Session screen in Urdu, laid out right to left: the start time, a Join button, a reminders note and today's portion" width="23%">
  <img src="docs/assets/screenshots/ur-quran.png" alt="Quran and Prayer screen in Urdu, laid out right to left: a Start reading card for Al-Fatihah, a memorisation card and a list of surahs" width="23%">
</p>

## What it does

- **Nearby circles.** Search and filter sessions by area, venue, section (women, men, family) and time, on a list or a map.
- **One-tap join and reminders.** Join a session, then get a confirmation and reminders before it starts, and a message if the time changes or it is cancelled.
- **Quran reader and prayer times.** Read the Quran with an Urdu translation, bookmark it, and see prayer times and the Hijri date.
- **Coordinator tools.** Run today's session from a phone: registrants, attendance, updates, time changes, the day's portion and posters.
- **Admin console.** Sessions, venues, coordinators, reports, exports, bulk import and an audit log, with every role limited to its own city or venue.
- **English and Urdu.** Every screen works left to right and right to left, at four text sizes, in light and dark.

## How it fits together

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
  Mail[Resend<br/>sign-in code email]
  Meta[WhatsApp Cloud API]
  Push[FCM, APNs, web push]

  UA --> Caddy
  AA --> Caddy
  CO --> Caddy
  Caddy -->|/api| API
  Caddy -->|/webhooks/whatsapp| W
  API --> DB
  API --> Mail
  W --> DB
  W --> PR
  W --> Meta
  W --> Push
```

One Postgres database, one API and one worker that owns everything that leaves the system. The reasons behind each choice are in [Architecture](docs/architecture.md).

## Repository map

A pnpm monorepo. Each app and package has its own short `README.md`; the full map, with owner lanes and how to test each part, is the [repository map](docs/engineering/repo-map.md).

| Path                   | What it is                                                                |
| ---------------------- | ------------------------------------------------------------------------- |
| `apps/api`             | HTTP API (Hono, TypeScript)                                               |
| `apps/worker`          | Background jobs: reminders, push, WhatsApp, poster renders, daily top-ups |
| `apps/poster-renderer` | Renders session posters and share cards, Urdu in Nastaliq                 |
| `apps/user-app`        | Expo user app (iOS, Android, PWA)                                         |
| `apps/admin-app`       | Expo admin and coordinator app                                            |
| `apps/console`         | React web console for admins (Vite)                                       |
| `packages/contracts`   | Zod schemas, API contract, OpenAPI, scope matrix, message formats, mock   |
| `packages/db`          | Drizzle schema, SQL migrations, seed and first-admin command              |
| `packages/ui`          | Design tokens, the shared component kit and bundled fonts                 |
| `packages/i18n`        | English and Urdu wording for every screen                                 |
| `packages/messaging`   | Providers and fakes for push, WhatsApp, SMS and email; email templates    |
| `packages/content`     | Quran reader, prayer times, Hijri date, bookmarks and reading progress    |
| `tools/`               | Run by hand: V1 migration, circles CSV cleaner, store asset generator     |
| `tests/`               | End-to-end tests and the scope and load runners                           |
| `infra`                | Docker Compose, Caddy, backups, deploy scripts, monitoring                |
| `docs`                 | Product decisions, engineering rules, design, agent briefs, public docs   |

## Quick start

You need Node 22 (see `.nvmrc`), pnpm through Corepack, and Docker for the local database.

```sh
corepack enable
pnpm install
pnpm check                                              # typecheck, lint, tests, format check
```

To run the apps against the contract's mock API, with no database (each command in its own terminal):

```sh
pnpm --filter @qc/user-app mock                          # mock API on http://localhost:4010
EXPO_PUBLIC_API_URL=http://localhost:4010 pnpm --filter @qc/user-app web
pnpm --filter @qc/console dev                            # proxies to the mock by default
```

To run the real API on a local Postgres:

```sh
docker compose -f infra/docker-compose.dev.yml up -d    # Postgres 17 on 127.0.0.1:5432
cp .env.example .env                                    # development-only values, never commit .env
pnpm --filter @qc/db migrate                            # apply the SQL migrations
pnpm --filter @qc/db seed                               # synthetic places, venues and sessions
```

Then start the API and worker as described in [Getting started](docs/getting-started.md), which also covers the poster renderer, the first admin and troubleshooting.

| Command                            | What it does                                                          |
| ---------------------------------- | --------------------------------------------------------------------- |
| `pnpm check`                       | Typecheck, lint, unit tests and format check                          |
| `pnpm test`                        | Unit tests in every package (not end-to-end)                          |
| `pnpm e2e`                         | End-to-end suite (starts its own stack, needs a Postgres)             |
| `pnpm format`                      | Fix formatting with Prettier                                          |
| `pnpm env:check`                   | Check every variable in the `.env.example` files is in `infra/ENV.md` |
| `pnpm --filter <package> <script>` | Run one package's script, for example `pnpm --filter @qc/api test`    |
| `node docs/public/build.mjs`       | Build the public documentation site ([how](docs/public/README.md))    |

**Windows:** the repository is stored with LF line endings and `.gitattributes` keeps them that way on checkout. If an older clone shows hundreds of files changed by `pnpm format:check`, run `git add --renormalize . && git status`, or re-clone.

## Deployment

> **Treat a push to `main` as a release.** Production runs on [Dokploy](https://dokploy.com), which pulls `main` from this repository, and [`docs/deployment.md`](docs/deployment.md) says auto-deploy is on. Work on a `lane/<lane>/<topic>` branch and merge to `main` only when the change is meant to go live. Run `pnpm check` before you push: CI (`.github/workflows/ci.yml`) is manual only (Actions > ci > Run workflow), never deploys and does not hold a deploy back.

The stack is the Compose file in `infra/` ([deployment overview](docs/deployment.md), runbook in [`infra/README.md`](infra/README.md)). Environment values are set in Dokploy and never committed:

- `.env.example`: development-only values for running the API and worker locally.
- `infra/.env.example`: the template for staging and production, with fake placeholders.
- [`infra/ENV.md`](infra/ENV.md): every variable, who reads it and whether it is required.

## Status

New here? Start with [`HANDOVER.md`](HANDOVER.md). Production is live at https://qurancircles.doraquran.pk and seeded with the Tanzeem circles; `main` auto-deploys. For the current state, open issues and decisions read [`docs/project-state.md`](docs/project-state.md). Waves 0 to 5 are built: contracts, every app and service, end-to-end tests, posters, the ayah of the day, the session companion and hardening. The apps follow the owner's redesign (D17 in [`docs/design/redesign-decisions.md`](docs/design/redesign-decisions.md)), sign-in codes go by email, and staging runs synthetic data with fake messaging. V1 (`usmankhan4001/nearby-dora-quran`) stays live until the pilot passes.

Release progress is tracked in the [go-live plan](docs/release/go-live.md), the [Play Console steps](docs/release/play-console.md) and the lane files in [`docs/agents/status/`](docs/agents/status/). [`docs/project-state.md`](docs/project-state.md) is the current snapshot (2026-10-28); [`docs/handoff.md`](docs/handoff.md) is the older 2026-10-18 one, and [`docs/archive/shared-folder/`](docs/archive/shared-folder/README.md) indexes the working material that used to live outside git.

## Documentation

The [documentation index](docs/README.md) lists every page by what you are trying to do. The most useful pages:

- [Getting started](docs/getting-started.md): set up, run each app, run the tests.
- [Repository map](docs/engineering/repo-map.md): every folder, its owner lane and how to test it.
- [Architecture](docs/architecture.md): how the parts fit together and why.
- [Deployment](docs/deployment.md): staging, production and backups.
- [Product decisions](docs/product/decisions.md): what is being built. Do not re-decide these.
- [Design](docs/design/README.md): the redesign decisions, the component kit and the screen specs.
- [Public documentation source](docs/public/README.md): the guides and API reference, in English and Urdu, and how they are built.
- [Handoff](docs/handoff.md): where the project stood when it was parked on 2026-10-18, what runs where and what is left.
- [Credits and licences](docs/credits-and-licences.md): fonts, the Quran text and the translations.

## Contributing and security

Branches are `lane/<lane>/<topic>`, each directory has one owner lane, and `pnpm check` must pass before you push. Read [Contributing](CONTRIBUTING.md) first; [GitHub settings](docs/engineering/github-settings.md) and the [branch inventory](docs/engineering/branch-inventory.md) cover the repository settings and which branches can go.

Report a vulnerability privately through the repository's **Security** tab, not in a public issue. See the [security policy](SECURITY.md).

## Credits

The apps bundle Plus Jakarta Sans (SIL OFL 1.1), Jameel Noori Nastaleeq (redistribution confirmed by the owner), Mehr Nastaliq Web (CC BY-SA 4.0) and KFGQPC Uthmanic Script HAFS (KFGQPC free-use licence, unmodified), and draw Phosphor icons (MIT). Posters use Figtree (SIL OFL 1.1). The Arabic Quran text comes from the Tanzil Project (CC BY 3.0) and the Urdu and English translations are by Sayyid Abul A'la Maududi, via Tanzil, for non-commercial use. Details are in [Credits and licences](docs/credits-and-licences.md).

## Licence

Proprietary. The Quran Circles code belongs to Tanzeem-e-Islami, all rights reserved; it is not open source and may not be copied, used or distributed without written permission. See [`LICENSE`](LICENSE). The bundled fonts and texts keep their own licences. Questions: support@qurancircles.doraquran.pk.
