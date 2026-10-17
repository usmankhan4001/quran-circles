# Status: contracts

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k

## Done

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

## In progress

- Seed from fixtures in `packages/db` after the schema lands.

## Blocked

- Gate 1 needs a human to review the role-and-scope matrix (`packages/contracts/SCOPES.md`). Wave 2 lanes were started provisionally at the owner's request; any change to the matrix after review is a contract change request.

## Questions for the orchestrator

- Posters, message-template editing, content-page editing, reports, bulk import and the demand map are not in the P0 contract. The lanes that need them (console WP7/WP15/WP19, renderer WP16) file change requests.
- Confirm the Hijri offset range (-2 to +2 days) and the OTP rules: 6 digits, channel WhatsApp with SMS fallback.
- Contract version is `1.0.0-rc.2` until Gate 1 is signed.
- The only pending-approval fixture circle is in Lahore, so the mock's Rawalpindi city coordinator (`mock-city`) has no circle to approve. Adding a pending Rawalpindi circle would change the `@qc/db` seed too; say if the drawings need it.

## Contract change requests

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008: auth-session-grace, users-display-name, otp-locale, outbox-venue-and-provider-id, legacy-subscriber-keys, console-bulk-import, console-export-scope, console-user-lookup-handover, reminder-lead-setting, bookmark-import-home.

Partly applied: admin-app-contract-notes (items 1, 2, 5; 3 and 4 deferred; 6 to 8 confirmations), api-core-contract-gaps (items 1 to 3; 4 and 5 not applied), console-contract-ergonomics (all four; item 3 documented, item 4 answered as "new invite"), messaging-env-vars (names added to `.env.example`).

Deferred (Wave 4): push-delivery-ack.

Not touched by this lane: auth-failure-reason, user-app-content-mount, and the ui-kit requests.
