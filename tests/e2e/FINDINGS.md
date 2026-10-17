# Integration findings (WP11, Wave 3)

Updated: 2026-10-17. Owner of this file: integration lane. Each finding is also noted in the owning
lane's status file under "Findings from integration". The integration lane does not patch other
lanes' code.

## How the suite runs

`pnpm --filter @qc/e2e test` (from the repository root) starts the real system once, runs every flow, and stops it:

- **Postgres**: a private throwaway cluster from the local server binaries (`initdb`, `pg_ctl`;
  as root it runs as the `postgres` user), or a fresh database on `E2E_DATABASE_URL` (for example
  `docker compose -f infra/docker-compose.dev.yml up -d` and
  `E2E_DATABASE_URL=postgres://qc:qc@localhost:5432/qc`). Docker does not run in the agent
  container, so the agent runs used the local Postgres 16 binaries. Without either, the run fails
  with that explanation; nothing is skipped.
- **Schema and data**: the real migrations (`@qc/db` migrate) and the synthetic `@qc/db` seed. The
  tests write only two things directly: the first national admin's invite (F-01), and reads of
  `message_outbox` that prove the worker sent something.
- **API**: `apps/api/src/index.ts` with `APP_ENV=test`, a random `AUTH_SECRET` per run,
  `AUTH_FIXED_CODE=123456` (test mode, refused in production), `MESSAGING_MODE=fake`,
  `TRUST_PROXY=true` (API-level tests give each synthetic person their own `X-Forwarded-For`).
- **Worker**: `apps/worker/src/main.ts` with `MESSAGING_MODE=fake`. Pushes and WhatsApp go to the
  fake providers; "sent" means the outbox row reached `sent` with a `fake-push-*` provider id.
  Nothing calls Meta, Google, Apple or an SMS service; the browser tests also refuse every host
  that is not on the loopback interface.
- **PWA**: `expo export --platform web` of `apps/user-app` with `EXPO_PUBLIC_API_URL` set to the
  real API, served as a single-page app.
- **Admin app**: the same for `apps/admin-app` (web target).
- **Console**: the `vite` dev server with `CONSOLE_API_PROXY_TARGET` set to the real API.

No app needed a code change to point at the real API.

Other commands: `pnpm --filter @qc/e2e test:api` (API flows only, about 2 minutes, because two
flows wait for the worker's per-minute reminder run), `pnpm --filter @qc/e2e test:web` (browser
flows), and `pnpm --filter @qc/e2e stack` to keep a stack running, then
`E2E_REUSE_STACK=1 pnpm --filter @qc/e2e test` against it. Each run keeps its logs in
`tests/e2e/node_modules/.cache/qc-e2e/runs/<pid>/logs/` (`api.log`, `worker.log`, `console.log`).

The root `pnpm test` (and so `pnpm check`) now runs this suite too. It takes about 4 minutes and
needs Postgres as described above.

## Flow status

| Gate 3 / brief flow                                       | API level                                                | UI level                                                         | Status  |
| --------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- | ------- |
| Find a session, register, get a reminder                  | `api/find-register-remind.spec.ts`                       | PWA nearby list, session, registration, Journey (`pwa/attendee`) | passing |
| Coordinator posts an update; it is in the feed; push sent | `api/update-feed-push.spec.ts`                           | Admin app posts it (`admin-app/coordinator`); PWA feed shows it  | passing |
| Code sign-in as attendee and as invited coordinator       | `api/sign-in.spec.ts`                                    | PWA attendee; console admin and invitee; admin app coordinator   | passing |
| Coordinator changes a session time; right people told     | `api/schedule-change.spec.ts` (push, WhatsApp, reminder) | Admin app schedule screen (`admin-app/coordinator`)              | passing |
| Scope isolation: venue coordinator vs another venue       | `api/scope-isolation.spec.ts`                            | Console sessions list and registrants page (`console/...`)       | passing |
| PWA installable, offline shell, deep links                | n/a                                                      | `pwa/shell.spec.ts` (manifest, service worker, offline reload)   | passing |
| Web push from the PWA (subscribe and receive)             | API side covered with a fake `webpush` device            | Needs a VAPID key pair (F-05)                                    | pending |
| Native apps on a simulator (Maestro)                      | n/a                                                      | No simulator in the agent container                              | pending |
| Real phone checks                                         | n/a                                                      | Needs a person (list below)                                      | pending |

## Findings

| ID   | What failed or does not match                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Owning lane                                                                     | Severity | Status                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------------------------- |
| F-01 | No supported way to create the first national admin. The seed writes no people (by design), no endpoint grants a role without an existing staff caller, and there is no command. A fresh staging or production database cannot be administered. The suite inserts a pending national invite with SQL, then signs in through the API.                                                                                                                                                                | api-core (needs an orchestrator decision: a CLI in `packages/db` or `apps/api`) | high     | open; worked around in tests |
| F-02 | The API runs overlapping queries on one pooled client inside a transaction. node-postgres prints `DeprecationWarning: Calling client.query() when the client is already executing a query` (an error from pg 9) during `POST /v1/registrations` and `POST /v1/admin/sessions/:id/schedule`. Candidates: `Promise.all` on the transaction handle in `modules/sessions/views.ts:62`, `modules/updates/publish.ts:209` and `modules/updates/reach.ts` (23, 58, 102). The PGlite tests cannot see this. | api-core                                                                        | medium   | open                         |
| F-03 | Every reminder reconcile is logged twice: `reminders.reconciled` is logged by `reminders/reconcile.ts:348` and again by `runtime.ts:154`. Not a double run (one outbox row, one push), but the duplicate lines make the log read as if each run happened twice.                                                                                                                                                                                                                                     | messaging (worker)                                                              | low      | open                         |
| F-04 | The admin app's sign-in helper text says "We send a code by text message" (`admin.signIn.phoneHelper`), but the app asks for `channel: 'whatsapp'` and the decision is WhatsApp first for staff too.                                                                                                                                                                                                                                                                                                | admin-app                                                                       | low      | fixed 2026-10-17             |
| F-05 | Web push in the PWA cannot be exercised: it is off without `EXPO_PUBLIC_VAPID_PUBLIC_KEY`, and the worker needs the matching VAPID keys. The flows register a fake `webpush` device through the API instead.                                                                                                                                                                                                                                                                                        | messaging + user-app (keys: orchestrator)                                       | medium   | pending outside dependency   |
| F-06 | The user-app status file names the maps key `EXPO_PUBLIC_GOOGLE_MAPS_KEY`; the code reads `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (`src/platform/env.ts`). A key set from the status file leaves the list-only map.                                                                                                                                                                                                                                                                                       | user-app                                                                        | low      | fixed 2026-10-17             |
| F-07 | Seed dates are February 2027 (the fixtures' `FIXTURE_NOW`). On a database seeded now, seeded sessions are months away, so Home's "next session" and "this week" views stay empty until someone creates current sessions. The flows that need "soon" create their own sessions through the admin API.                                                                                                                                                                                                | contracts and db (seed)                                                         | low      | open; note for staging demos |
| F-08 | The suite ran on Postgres 16 (container binaries); `infra/docker-compose.dev.yml` and production use Postgres 17. Run once with `E2E_DATABASE_URL` against the compose database before signing Gate 3.                                                                                                                                                                                                                                                                                              | integration                                                                     | low      | open                         |
| F-09 | The PWA's Home fetches the ayah of the day from api.alquran.cloud at runtime (decision 0008). With outside hosts blocked, Home still renders. Noted so the offline and data-cost reviews include it.                                                                                                                                                                                                                                                                                                | content                                                                         | info     | no action needed             |
| F-10 | Offline, the PWA's shell opens (service worker) and shows the app's cached data, but the offline banner appears only after an API call fails (`core/connectivity.ts`). On an offline start whose screens are served from the cache, no banner showed in one of the runs, so a person can see old data with no sign that the phone is offline. `navigator.onLine` is not consulted.                                                                                                                  | user-app                                                                        | low      | fixed 2026-10-17             |

Nothing else failed. Every response in the API flows was parsed by the `@qc/contracts` client
schemas (no contract drift found). Every refusal was 403 or 404, as the scope matrix says. No phone
number or name appeared in the API or worker logs. CORS let the PWA and the admin app call the API
from their own origins.

## Manual checks for a person

These cannot run in the agent container (no simulator, no phone, no outside network):

1. **Install the PWA on a real Android phone** (Chrome) and on an iPhone (Safari, Add to Home
   Screen): icon, name and colours from the manifest; it opens standalone at `/home`.
2. **Offline shell on the phone**: open the installed app once online, switch to airplane mode and
   reopen it. The shell shows, with no browser error page. Note whether the offline banner shows
   (F-10).
3. **Web push on the phone** (needs the F-05 keys): allow notifications, have a coordinator post a
   venue update, check the notification arrives with the app closed and opens the update.
4. **Deep links**: a session link in a WhatsApp message (`/session/<id>`) opens the installed PWA
   on that session; with the native app installed it opens the app.
5. **Code sign-in with a real number** on staging (live messaging, approved WhatsApp template):
   the code arrives on WhatsApp; with WhatsApp unavailable, the SMS fallback arrives.
6. **Native apps (Maestro on a simulator, then a real device)**: the same five flows in the user
   app and admin app builds; the push permission prompt and a received push on Android (FCM) and
   iOS (APNs).
7. **Reminder timing on a phone**: register for a session that starts within 90 minutes; the
   reminder arrives about 60 minutes before the start, in the phone's language.
8. **Urdu and large text on a low-end Android phone**: sign-in, registration and the feed in Urdu
   at the largest text size, right to left.
