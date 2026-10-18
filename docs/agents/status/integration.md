# Status: integration

Updated: 2026-10-18
Branch: claude/peaceful-archimedes-ain95k (nothing committed by this lane; owner's process: no pull requests, no GitHub Actions)

## Done

- 2026-10-18 (performance pass, at the orchestrator's request; `tests/e2e` only): **browser tests no longer route requests.** Playwright routing (`localOnly` and the Quran stub) sent every request through the test process, which delayed requests made while the page's main thread was busy and skewed the low-end timings. Now `src/support/network.ts` gives every browser project Chromium launch arguments: `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1` (IP literals included) plus `--no-proxy-server --proxy-server=direct://` (the headless shell ignores `--no-proxy-server` alone and would use a proxy from the environment, which resolves outside names itself). `localOnly(context)` keeps its signature: it checks once per browser that the block is in place (a non-allowed loopback address must be unresolvable, and an `https://….invalid` address must fail in Chromium's resolver and not at a proxy; neither probe can leave the machine) and records refused hosts from `requestfailed`. The Quran stub (`src/quality/quran-stub.ts`) is now a local HTTPS server (self-signed certificate made with openssl into `node_modules/.cache/qc-e2e/quran-stub/`, gzip, CORS) on a loopback port (`QC_QURAN_STUB_PORT`, else derived from the runner's pid); the quality project maps `api.alquran.cloud` to it and its contexts use `ignoreHTTPSErrors`. Chromium's own throttling now applies to it, so the manual delay is gone.
- `@qc/e2e` (`tests/e2e`) set up with Playwright 1.56.1 (matches the pre-installed Chromium build 1194). One `pnpm --filter @qc/e2e test` starts the real stack, runs every flow and stops it:
  - Postgres: private throwaway cluster from the local server binaries, or a fresh database on `E2E_DATABASE_URL` (the dev compose database works). Real migrations and the synthetic `@qc/db` seed.
  - Real API (`APP_ENV=test`, random secret per run, test-mode fixed code) and real worker, both `MESSAGING_MODE=fake`. Browser tests refuse every non-loopback host.
  - PWA and admin app: Expo web exports with `EXPO_PUBLIC_API_URL` = the real API. Console: Vite dev server with `CONSOLE_API_PROXY_TARGET` = the real API. No app needed a code change.
- Flows (25 tests, about 4 minutes): find, register and a reminder sent by the worker; coordinator update in the feed with a push sent; code sign-in as attendee and as invited coordinator (API, PWA, console, admin app); session time change notifying registrants by push and WhatsApp, re-timing a queued reminder, and not reaching other sessions' people; scope isolation through real sign-in (API and console); PWA manifest, service worker offline shell and deep links.
- Every API response in the flows is parsed by the `@qc/contracts` client schemas: no contract drift found.
- `tests/e2e/FINDINGS.md`: 10 findings routed to api-core, messaging, admin-app, user-app, content, contracts/db, and a list of manual phone checks. Each owning lane's status file has a "Findings from integration" note.
- Checks: `pnpm --filter @qc/e2e test`, typecheck, eslint and prettier on `tests/e2e` pass.

- 2026-10-17 (fix pass by another agent for F-01, F-02, F-03, F-07; `tests/e2e/src` touched only for these): `support/people.ts` creates national admins by running `packages/db` `src/cli/bootstrap-admin.ts --phone <synthetic> --force-additional` on the run's database and checks it printed an invite id and not the number; `support/db.ts` is now read-only; `support/seed.ts` comment updated for the seed's current-week dates. FINDINGS.md marks F-01, F-02, F-03 and F-07 fixed.

## In progress

- Nothing.

## Blocked / pending

- Web push from the PWA: needs the VAPID key pair (F-05).
- Native apps with Maestro on a simulator: no simulator in the agent container.
- Real phone checks (PWA install, offline on a phone, push, deep links, live code delivery): need a person; list in `tests/e2e/FINDINGS.md`.
- Gate 3 sign-off also wants one run on Postgres 17 (`E2E_DATABASE_URL` against `infra/docker-compose.dev.yml`, F-08).

## Questions for the orchestrator

- F-01: answered (2026-10-17): a CLI in `packages/db`. The suite now creates national admins with `bootstrap-admin` (no SQL writes left in `tests/e2e`).
- Decided by the orchestrator (2026-10-17): the root `pnpm test` and `pnpm check` skip the e2e suite so they stay fast; run it with `pnpm e2e` (same as `pnpm --filter @qc/e2e test`) before signing a gate.

## Contract change requests

- None.

## Wave 4 full check (2026-10-17)

- Typecheck, lint and format pass. All 7,436 tests pass when packages run one at a time (`pnpm -r --workspace-concurrency=1 --filter '!@qc/e2e' test`, about 7 minutes here).
- With the default parallel run, two UI tests timed out under load (console `coordinators.test.tsx`, content `V1ImportBanner.test.tsx`); both pass on their own. The console now uses the same 5 s async timeout as the admin app and content. Open: decide whether the root `test` script should limit workspace concurrency.
