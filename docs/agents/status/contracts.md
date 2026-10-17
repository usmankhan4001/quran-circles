# Status: contracts

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k

## Done

- 2026-10-17: `@qc/db` exports shared scheduled jobs from `src/jobs/`: `topUpAllOccurrences` (moved from the API, behaviour unchanged) with its planner (`planOccurrences`, `topUpOccurrences`, `scheduleSpecOf`, `DEFAULT_OCCURRENCE_HORIZON_DAYS` = 90), tested on PGlite in `src/jobs/top-up.test.ts`.
- API contract: 80 operations (73 in rc.1, 7 added in rc.2) in `packages/contracts/src/endpoints.ts`, with Zod request and response schemas, error lists, rate-limit buckets and idempotency flags.
- OpenAPI 3.1 generated into `packages/contracts/openapi.json` (`pnpm --filter @qc/contracts gen`), kept in sync by a test.
- Scope matrix in `packages/contracts/src/scopes.ts` (`can`, `scopeFilter`), generated table in `packages/contracts/SCOPES.md`, tested for every role against every action.
- Error codes (24, stable statuses) with English and Urdu draft messages in `packages/i18n` (`errors.<code>`).
- Message formats: outbox payloads, 8 template ids with variables and English/Urdu draft wording, push payload, deep links.
- Typed client (`createApiClient`) and a mock server generated from the contract (`pnpm --filter @qc/contracts mock`, port 4010), serving fixtures for discovery endpoints and generated data for the rest, with every error case reachable through `x-mock-error`.
- Fixtures: synthetic provinces, the nine V1 cities, areas, sample venues, circles, sessions, occurrences, content, updates.
- Contract tests: registry vs OpenAPI vs scopes vs mock vs client; fixtures validate against schemas.
- Key rules in `docs/engineering/i18n-keys.md`.
- Database schema and migrations: built by a parallel agent in `packages/db` (see the db section of the lane report).

- 2026-10-17: contract 1.0.0-rc.2 and migration 0008 applied from the owner-approved digest (`docs/engineering/change-requests/2026-10-17-digest.md`). Bulk import (venues, coordinators, sessions), scoped registration export, `adminSessions.get`, `adminCircles.get`, `adminUpdates.preview`, reminder lead settings, handover on invites, circle archive, `ApiClientError.issues`, `@qc/contracts/bookmarks`. No new scope action, so the SCOPES.md matrix is unchanged. See `packages/contracts/CHANGELOG.md`. `@qc/db`: 160 tests. `@qc/contracts`: 1463 tests.

- 2026-10-17: mock server usable for staff screens (mock and fixtures only; registry, schemas, scope matrix and `openapi.json` unchanged, contract stays rc.2). Staff sign-in from synthetic numbers with code `123456`: `+923000000201` → `mock-venue` (venue coordinator, Sample Masjid Al-Noor), `+923000000202` → `mock-city` (city coordinator, Rawalpindi), `+923000000203` → `mock-staff` (national admin); `me.get` and `auth.refresh` keep the role (`staffAccounts` in fixtures). Staff requests are checked with `can`/`scopeFilter` (forbidden by role or out-of-scope record; not_found on scoped reads). Fixture-backed, scoped `adminVenues.list`, `adminSessions.list`, `adminCircles.list`, plus `adminSessions.occurrences`, `adminAttendance.get`, `registrations.forSession` (`staffRegistrants`), scoped `adminRegistrations.export`. Attendee behaviour unchanged. `@qc/contracts`: 1487 tests; `@qc/admin-app` 534 and `@qc/console` 263 still pass.

- 2026-10-17: contract 1.0.0-rc.3 (additive, no database change, `SCOPES.md` unchanged). `Invite.replacesAssignmentId` (uuid or null; optional in the TS type so rc.2 data still typechecks) so a console Resend keeps a handover; `invalid_range` added to `IMPORT_SERVER_ISSUE_CODES` (session `endsOn` before `startsOn`) with `ImportServerIssueCode`; `conflict` listed on the three `adminImport.*` endpoints (an import that races another write; replaces the API's unlisted `changed_during_import` 400); `not_found` listed on `adminRegistrations.export` for an unknown `cityId`/`venueId` (staff only; no export right is still `forbidden`). Mock: `adminRoles.invite` echoes the body including the handover; the scoped export answers `not_found` for unknown ids and `forbidden` for a known place out of scope. `openapi.json` regenerated. See `packages/contracts/CHANGELOG.md`. `@qc/contracts`: 1501 tests; `@qc/console` 273 and `@qc/admin-app` 553 still pass, both typecheck.

- 2026-10-17: integration findings F-01 and F-07 (db side), F-02 guard. `@qc/db`: 198 tests in 8 files.
  - **`pnpm --filter @qc/db bootstrap-admin --phone <E.164>`** (F-01, `src/bootstrap-admin.ts`, `src/cli/bootstrap-admin.ts`): creates the pending national-admin invite the API's `adminRoles.invite` creates (7-day expiry; retires a lapsed one and replaces a live one for the same number, as a resend) and a `role.invite` audit row with no actor and `meta.source = 'bootstrap-admin'`, in one transaction. The person signs in with a code and the invite becomes the role. No WhatsApp invitation is queued. Refuses when an active national admin exists (live assignment, active account) unless `--force-additional`; in production (`APP_ENV`/`NODE_ENV`) unless `--yes` (checked before connecting); a non-E.164 number; a number that already holds the role. Prints only the invite id. 15 PGlite tests. Documented in `packages/db/README.md` (new).
  - Seed dates (F-07): `seedDatabase(db, { anchor })` / `buildSeedRows({ anchor })` move every fixture date by whole weeks so the fixtures' first day (Monday 15 Feb 2027) lands on the Monday (Pakistan date) of the anchor's week; weekdays and wall-clock times unchanged. Without `anchor` the fixture dates are kept (tests deterministic, mock parity). The `seed` CLI anchors on today by default; `--anchor YYYY-MM-DD|ISO` fixes it, `--fixture-dates` keeps Feb 2027. A rerun with another anchor still adds nothing (same ids).
  - `@qc/db/testing` (new export): `guardTransactions(pglite)` makes a PGlite transaction client throw `OverlappingQueryError` on overlapping queries, as node-postgres 9 will (F-02). Used by the db, API and worker test databases.
- **For the platform lane** (do not edit `infra/` from here): add to `infra/README.md` the first-admin step after `migrate` on a fresh staging or production database: `DATABASE_URL=... pnpm --filter @qc/db bootstrap-admin --phone <E.164> [--yes]` (`--yes` is required when `APP_ENV=production`), then the person signs in to the console with a code. Staging demos: `pnpm --filter @qc/db seed` now dates the sample sessions to the current week.

## In progress

- Seed from fixtures in `packages/db` after the schema lands.

## Blocked

- Gate 1 needs a human to review the role-and-scope matrix (`packages/contracts/SCOPES.md`). Wave 2 lanes were started provisionally at the owner's request; any change to the matrix after review is a contract change request.

## Questions for the orchestrator

- Posters, message-template editing, content-page editing, reports, bulk import and the demand map are not in the P0 contract. The lanes that need them (console WP7/WP15/WP19, renderer WP16) file change requests.
- Confirm the Hijri offset range (-2 to +2 days) and the OTP rules: 6 digits, channel WhatsApp with SMS fallback.
- Contract version is `1.0.0-rc.3` until Gate 1 is signed.
- The only pending-approval fixture circle is in Lahore, so the mock's Rawalpindi city coordinator (`mock-city`) has no circle to approve. Adding a pending Rawalpindi circle would change the `@qc/db` seed too; say if the drawings need it.

## Contract change requests

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008: auth-session-grace, users-display-name, otp-locale, outbox-venue-and-provider-id, legacy-subscriber-keys, console-bulk-import, console-export-scope, console-user-lookup-handover, reminder-lead-setting, bookmark-import-home.

Partly applied: admin-app-contract-notes (items 1, 2, 5; 3 and 4 deferred; 6 to 8 confirmations), api-core-contract-gaps (items 1 to 3; 4 and 5 not applied), console-contract-ergonomics (all four; item 3 documented, item 4 answered as "new invite"), messaging-env-vars (names added to `.env.example`).

Deferred (Wave 4): push-delivery-ack.

Not touched by this lane: auth-failure-reason, user-app-content-mount, and the ui-kit requests.

## Findings from integration

- F-07 (low, **fixed 2026-10-17**: the seed CLI anchors dates on the current week, see Done): the `@qc/db` seed copies the fixtures, which are dated February 2027 (`FIXTURE_NOW`). A database seeded now has no sessions in the next months, so Home's "next session" and "this week" views are empty on staging until current sessions are created. The e2e flows create their own sessions through the admin API. Details in `tests/e2e/FINDINGS.md`.
