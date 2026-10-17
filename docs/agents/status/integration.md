# Status: integration

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k (nothing committed by this lane; owner's process: no pull requests, no GitHub Actions)

## Done

- `@qc/e2e` (`tests/e2e`) set up with Playwright 1.56.1 (matches the pre-installed Chromium build 1194). One `pnpm --filter @qc/e2e test` starts the real stack, runs every flow and stops it:
  - Postgres: private throwaway cluster from the local server binaries, or a fresh database on `E2E_DATABASE_URL` (the dev compose database works). Real migrations and the synthetic `@qc/db` seed.
  - Real API (`APP_ENV=test`, random secret per run, test-mode fixed code) and real worker, both `MESSAGING_MODE=fake`. Browser tests refuse every non-loopback host.
  - PWA and admin app: Expo web exports with `EXPO_PUBLIC_API_URL` = the real API. Console: Vite dev server with `CONSOLE_API_PROXY_TARGET` = the real API. No app needed a code change.
- Flows (25 tests, about 4 minutes): find, register and a reminder sent by the worker; coordinator update in the feed with a push sent; code sign-in as attendee and as invited coordinator (API, PWA, console, admin app); session time change notifying registrants by push and WhatsApp, re-timing a queued reminder, and not reaching other sessions' people; scope isolation through real sign-in (API and console); PWA manifest, service worker offline shell and deep links.
- Every API response in the flows is parsed by the `@qc/contracts` client schemas: no contract drift found.
- `tests/e2e/FINDINGS.md`: 10 findings routed to api-core, messaging, admin-app, user-app, content, contracts/db, and a list of manual phone checks. Each owning lane's status file has a "Findings from integration" note.
- Checks: `pnpm --filter @qc/e2e test`, typecheck, eslint and prettier on `tests/e2e` pass.

## In progress

- Nothing.

## Blocked / pending

- Web push from the PWA: needs the VAPID key pair (F-05).
- Native apps with Maestro on a simulator: no simulator in the agent container.
- Real phone checks (PWA install, offline on a phone, push, deep links, live code delivery): need a person; list in `tests/e2e/FINDINGS.md`.
- Gate 3 sign-off also wants one run on Postgres 17 (`E2E_DATABASE_URL` against `infra/docker-compose.dev.yml`, F-08).

## Questions for the orchestrator

- F-01: how should the first national admin be created on a fresh database (a CLI in `packages/db` or `apps/api`)? The suite inserts a pending national invite with SQL until then.
- The root `pnpm test` (and `pnpm check`) now runs the e2e suite, which needs Postgres binaries or `E2E_DATABASE_URL` and takes about 4 minutes. Keep it in `pnpm check`, or run it only through `pnpm --filter @qc/e2e test`?

## Contract change requests

- None.
