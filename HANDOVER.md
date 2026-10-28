# HANDOVER: Quran Circles V2

The single entry point for a new agent or developer taking over. Written 2026-10-28. It links to everything; read it first, then [`AGENTS.md`](AGENTS.md) and the `CLAUDE.md` of the directory you will edit.

## 1. What this is

Quran Circles V2, for Tanzeem-e-Islami: people find a Quran circle near them, pledge to join a session, get confirmations and reminders, and read the Quran; coordinators run sessions from a phone; admins manage everything in a web console. English and Urdu (right to left). A pnpm monorepo (Node 22, pnpm 10.28, Postgres 17) with an API, worker, poster renderer, Expo user and admin apps, and a React console. Proprietary code ([`LICENSE`](LICENSE)). V1 is a separate repository (`usmankhan4001/nearby-dora-quran`) and is off limits.

## 2. Current state (2026-10-28)

- **Live in production** at https://qurancircles.doraquran.pk, console at https://qurancircles-admin.doraquran.pk, coordinator web app (the admin-app, same app as on coordinators' phones) at https://coordinator.doraquran.pk. All three share one Caddy container (`web`); the coordinator name comes from `QC_COORDINATOR_DOMAIN` and defaults to `coordinator.doraquran.pk`. Its DNS is covered by the Cloudflare wildcard to the tunnel. Dokploy pulls `main` from GitHub and auto-deploys, so **every push to `main` is a release**.
- Sign-in is an emailed 6-digit code (Resend). Seat booking was replaced by a join pledge. The Mushaf reader has readability fixes and a stopgap font fix (`4e7f28a`, on `main`).
- Production was seeded on 2026-10-26 with the Tanzeem circles: 42 cities, 167 venues, 139 published sessions.
- The Google Play release is prepared, not published. Urdu strings are drafts awaiting a native reader.
- Local `main` equals `origin/main`. origin has only `main`; no stashes. More detail: [`docs/project-state.md`](docs/project-state.md).

## 3. Read in this order

1. [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md): rules, commands, boundaries.
2. [`docs/project-state.md`](docs/project-state.md): state, open decisions and issues, branch and worktree state.
3. [`docs/handover/`](docs/handover/README.md): history by thread, decisions and incidents, email setup, assets.
4. Your lane's brief ([`docs/agents/briefs/`](docs/agents/briefs/)) and status file ([`docs/agents/status/`](docs/agents/status/README.md)); ownership in [`docs/engineering/ownership.md`](docs/engineering/ownership.md).
5. [`docs/product/decisions.md`](docs/product/decisions.md) only when a product decision is in question. Do not re-decide one.
6. [`docs/README.md`](docs/README.md): the full documentation index.

## 4. Run, test, deploy

| Task           | How                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install        | `corepack enable`, `pnpm install` (Git Bash or WSL on Windows)                                                                                                                     |
| Run locally    | [`docs/getting-started.md`](docs/getting-started.md) (dev Postgres via `infra/docker-compose.dev.yml`)                                                                             |
| Gate           | `pnpm check` (typecheck, lint, tests, format check); `pnpm env:check` after touching an env example; `pnpm e2e` needs Postgres and Chromium                                        |
| Known red      | `apps/api` `cluster.test.ts` fails on Windows with ECONNRESET (also on untouched `main`); `MushafView.tsx` is unformatted on `main` (another thread owns it)                       |
| Deploy         | Push to `main`; Dokploy builds from the compose in `infra/`. Only the owner or orchestrator pushes to `main`. Lane agents push `lane/<lane>/<topic>` branches                      |
| Environment    | Every variable: [`infra/ENV.md`](infra/ENV.md); fake examples in `.env.example` and `infra/.env.example`                                                                           |
| Email sign-in  | [`docs/handover/resend-email-setup.md`](docs/handover/resend-email-setup.md)                                                                                                       |
| Load circles   | [`tools/circles-load/README.md`](tools/circles-load/README.md), runbooks in [`docs/archive/shared-folder/seeding/`](docs/archive/shared-folder/seeding/)                           |
| Release / Play | [`docs/release/go-live.md`](docs/release/go-live.md), [`docs/release/play-console.md`](docs/release/play-console.md), [`docs/release/play-launch.md`](docs/release/play-launch.md) |

## 5. Accounts and services involved (names only, no secrets)

| Service                                | Used for                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GitHub (`usmankhan4001/quran-circles`) | Source; public repository; CI is manual and never deploys                                                              |
| Dokploy                                | Production and staging hosting; pulls `main`; env vars live here; Terminal on the postgres service for backups and SQL |
| Cloudflare                             | DNS for `doraquran.pk` (wildcard to a tunnel, plus explicit records), the tunnel to the host                           |
| Resend                                 | Email sign-in codes and notifications from `notifications@qurancircles.doraquran.pk`                                   |
| Google Maps Platform                   | Web and Android map keys (referrer restrictions must list the new host)                                                |
| Firebase / FCM, Expo EAS               | Android push and the Android build (`pk.doraquran.circles`)                                                            |
| Google Play Console                    | Store listing, data safety, reviewer access (not published yet)                                                        |
| Meta WhatsApp Business                 | Confirmations and reminders (optional; sign-in does not use it)                                                        |
| Claude project "Quran Circles"         | Orchestration threads, shared Library folder; the full discussion history lives there                                  |

Keys and passwords are held by the owner in Dokploy and the service dashboards, never in the repository.

## 6. Open items

Full tables with lanes are in [`docs/project-state.md`](docs/project-state.md#open-issues-and-decisions). The ones to act on first:

1. **Rotate secrets** that were pasted into chats: the Resend API key, the database passwords in the Dokploy env, and the earlier Dokploy API key. Not recorded as done.
2. **Mushaf font.** `4e7f28a` is a stopgap: it maps one sign and drops three (it loses the low-meem recitation sign). The proper fix is switching to Amiri Quran (SIL OFL), which draws all four. Not decided; it changes the shared UI kit (ui lane, on a branch). Another thread owns `MushafView.tsx`.
3. **Confirm production env** has `RESEND_API_KEY`, `APP_ENV=production`, `MESSAGING_MODE=live`, `AUTH_PHONE_SIGN_IN` unset and the three domain variables on the `qurancircles` host. Check Maps key referrers, Firebase authorised domains and Play URLs on the new host.
4. **Mail routing** for `support@` and `privacy@qurancircles.doraquran.pk`.
5. **Store listing text** still says "reserve your seat" (seat booking is gone).
6. **Urdu review** by a native reader; regenerate the proofreading sheet from `packages/i18n` first.
7. **Owner decisions** pending: placeholder features (hide or "Coming soon"), Quran text and translation rights, ayah-of-the-day English translation, venue photos, geocoding service.
8. **Engineering follow-ups:** offline attendance queue, http-only refresh-token cookie for the web app, persistent rate limits before a second API container, reviewer access for Play, rewrite the store-assets capture script for the join pledge.

## 7. Lessons that save time

- DNS: a wildcard does not cover a name that has its own MX or other records; add an explicit record ([`docs/handover/decisions-and-incidents.md`](docs/handover/decisions-and-incidents.md)).
- Test "the site is down" from another network and resolver before touching the stack.
- Compare branches with `git cherry` (content), not hashes; check before deleting anything. The two lane worktrees `../qc-admin-bootstrap` and `../qc-tanzeem-local` are fully merged, locked and kept; `qc-tanzeem-local` holds the owner's local `.env` and seed database setup.
- Agent sandboxes cannot push or touch production; the owner's PC runs with a permission layer that refuses production writes, DNS changes and some pushes. Give the owner exact copy-paste commands for those.
- Never log phone numbers, names or message bodies; never commit real personal data (the circles CSV has phone numbers).

## 8. Where the old material went

Everything that used to live in the project's shared folder is indexed in [`docs/archive/shared-folder/README.md`](docs/archive/shared-folder/README.md), with the result of checking every code bundle against `main`.

## 9. Next steps for a new agent

1. Read sections 3 and 6, then ask the owner which open item to take, or take the next step in your lane's status file.
2. Branch `lane/<lane>/<topic>` from `main`; small commits; tests with the code; English and Urdu strings together.
3. `pnpm check` before you ask for a merge; update `docs/agents/status/<lane>.md` last.
4. The owner or orchestrator merges to `main`; nothing is deployed until then.
