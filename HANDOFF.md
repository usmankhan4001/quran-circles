# Handoff: Quran Circles V2, parked on 2026-10-18

The project is paused. This page is for whoever picks it up next: what exists, what runs where, and what is left. The final state of `main` is tagged `v2-parked-2026-10-18`.

## In one paragraph

The whole V2 platform is built and tested: database, API, worker, poster renderer, user app (PWA, with iOS and Android builds configured), coordinator app and admin console, in English and Urdu. Waves 0 to 4 are built, and Wave 5 (hardening) is done apart from the full restore drill, which needs a production server. The apps were redesigned to the owner's Iqraa showcase (decision D17) and that version runs on staging. Nothing is in production: no production server, domain, store listing or real messaging account exists yet. V1 (`usmankhan4001/nearby-dora-quran`) is still the live app.

## Where things run

| What            | Where                                                                                           | State                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| User app (PWA)  | https://staging.doraquran.pk                                                                    | Staging, redesigned build from `main` 8690ca4, healthy on 2026-10-18                    |
| Console         | https://staging-console.doraquran.pk                                                            | Staging, same build                                                                     |
| API health      | https://staging.doraquran.pk/api/health                                                         | Staging                                                                                 |
| Coordinator app | Not deployed                                                                                    | Store app only; staging has no web build of it                                          |
| Staging server  | Dokploy, project `quran-circles-staging`, app `quran-circles` (Compose)                         | Deploys from a git clone of this repository; Traefik and a Cloudflare tunnel in front   |
| Production      | Not created                                                                                     | `infra/` is ready for one VPS with Docker Compose; see [Deployment](docs/deployment.md) |
| Store assets    | [`tools/store-assets/`](tools/store-assets/README.md), [listing](docs/release/store-listing.md) | Icons in the apps; screenshots and listing drafted, not uploaded                        |

Staging is left running as it is. It uses synthetic data, `MESSAGING_MODE=fake` (no real WhatsApp, SMS or push) and a fixed sign-in code, `AUTH_FIXED_CODE`, kept only in the Dokploy environment. Sign in with a made-up number, or with one of the seeded test admin numbers for the console; each number can request 5 codes an hour. All secrets live in Dokploy, never in this repository.

To deploy a new version to staging: push to `main`, then start a deploy of the `quran-circles` app in Dokploy. The record of each staging deploy is in [`docs/agents/status/platform.md`](docs/agents/status/platform.md).

## State of each wave

| Wave | What                                                                    | State                                                                                                                                                                                                                                                                                     |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Scaffold, CI, briefs                                                    | Built. Gate not signed: the VPS and the Meta (WhatsApp) account were never provided                                                                                                                                                                                                       |
| 1    | Contracts: schema, API contract, scope matrix, message formats          | Done, gate signed by Muhammad on 2026-10-16                                                                                                                                                                                                                                               |
| 2    | Parallel build of every app and service                                 | Built, `pnpm check` passes. Gate not formally signed                                                                                                                                                                                                                                      |
| 3    | Integration and end-to-end tests                                        | Built (`tests/e2e`)                                                                                                                                                                                                                                                                       |
| 4    | Features: posters, ayah of the day, session companion, memorisation     | Built                                                                                                                                                                                                                                                                                     |
| 5    | Hardening: security, permissions, load, accessibility, low-end, restore | Done except the full restore drill (below). Muhammad ran the low-end phone check on staging on 2026-10-18: all checks OK. Load on staging at 2 CPUs: 268 requests/s, p95 0.12 s at 100 users, 0 errors; 0 permission leaks across 95 endpoints; in-stack restore check passes (41 tables) |
| 6    | Pilot and release (WP13)                                                | Not started. Needs production, store accounts, Meta approval and the Urdu review                                                                                                                                                                                                          |
| 7    | Circle requests and demand map (WP19, WP20)                             | Not started                                                                                                                                                                                                                                                                               |

The lane-by-lane detail is in [`docs/agents/status/`](docs/agents/status/README.md); gate sign-offs are in [`orchestrator.md`](docs/agents/status/orchestrator.md). The redesign record is [`docs/design/redesign-decisions.md`](docs/design/redesign-decisions.md) (D17 is the current look).

## Open items

### Waiting on a person

| Item                                    | Who                  | Notes                                                                                                                                                                                       |
| --------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Urdu proofreading                       | A native Urdu reader | Every Urdu string is a draft: app text in `packages/i18n` (a 1,614-line review sheet was shared in the project folder `urdu-proofreading/`), the store listing and the screenshot headlines |
| Publisher name                          | Muhammad             | Confirm "Tanzeem-e-Islami" as the store publisher (taken from the logo)                                                                                                                     |
| Larger or vector logo                   | Muhammad             | The master is 668 px, so the 1024 icon is upscaled. Drop a vector or 2048 px file into `tools/store-assets/source/` and re-run                                                              |
| Rotate the Dokploy API key              | Muhammad             | A Dokploy API key was pasted into a chat. Revoke it in Dokploy and create a new one                                                                                                         |
| WhatsApp Business owner and Meta review | Muhammad             | Name the legal owner, start Meta business verification and template approval                                                                                                                |
| Pilot city, first coordinators          | Muhammad             | Needed for Wave 6                                                                                                                                                                           |

### Infrastructure

- **Production VPS and domain.** Not created. The app ID follows from the domain. Checklist: [`infra/README.md`](infra/README.md#what-the-owner-must-provide).
- **Web push keys (VAPID), FCM and APNs.** Not generated. Push stays fake until they exist.
- **Full restore drill.** Needs root on a real server; run it on production once it exists ([`docs/quality/restore-drill.md`](docs/quality/restore-drill.md)).
- **Database CPU at peak.** Postgres CPU is the limit under load. Watch it on the first Ramadan evening and size up before the pilot if needed ([`infra/ENV.md`](infra/ENV.md), "Database connections").
- **External keys.** The Quran text comes from api.alquran.cloud at run time and the map needs a Google Maps key; neither works without network access and a key in the environment. Run `node packages/content/scripts/compare-aladhan.mjs` once with internet access to compare prayer times.
- **Store accounts.** Apple and Google developer accounts are not set up.

### Features drawn in the design with no data or API yet

The apps show these as placeholder, sample or disabled content (D17: copy every drawn element).

- Seat pass and QR check-in
- Livestream of a session
- Reciter audio in the Quran reader
- Circle and venue photos (needs a photo field, upload, storage and each masjid's permission)
- Teacher names on sessions
- Ramadan events
- GPS location (Nearby uses the chosen city and area today)
- Console numbers: registrations this month, attendance percentage, exact totals, search beyond loaded rows, attendance export and export history, add one session or venue from a form
- Kit pieces still drawn inside the apps (map pins, people stepper, choice cards): move into `packages/ui`

### Decisions and change requests

- Open contract change requests are in [`docs/engineering/change-requests/`](docs/engineering/change-requests/); the list waiting on the orchestrator is in [`orchestrator.md`](docs/agents/status/orchestrator.md).
- Next features decided with the owner but not scheduled: [`docs/product/features-next.md`](docs/product/features-next.md).
- Quran text and translation rights: the Maududi translations are used non-commercially under Tanzil's terms. A full offline copy waits for written rights ([credits](docs/credits-and-licences.md)).
- V1 data migration has only been dry-run; the real run is part of Wave 6 ([`tools/migration`](tools/migration/README.md)).

## Picking it up

1. Read this page, then [README](README.md), [Getting started](docs/getting-started.md) and [Architecture](docs/architecture.md).
2. `corepack enable && pnpm install && pnpm check` must pass before you change anything.
3. Run the apps against the mock API (README, Quick start), then against a local Postgres.
4. Agents: read [`CLAUDE.md`](CLAUDE.md) and [`docs/agents/README.md`](docs/agents/README.md). Work is split into lanes with one owner per directory ([ownership](docs/engineering/ownership.md)); the UI lane owns the component kit and its right-to-left and accessibility rules.
5. The next step is Wave 6: create production, finish the open items above, then pilot in one city.
