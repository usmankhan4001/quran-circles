# Status: api-core

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k

## Done (2026-10-17: after rc.3, session end date issue code)

- `adminSessions.create` and `adminSessions.changeSchedule` now report an `endsOn` before the session's `startsOn` as `validation_failed` `{path: 'endsOn', code: 'invalid_range'}` (was `invalid_reference`), the code the import uses for the same check. Same day is still fine. `adminSessions.update` takes no `endsOn` (`SessionUpdate`), so the schedule change is the only update path with this check. The contract lists no per-field codes for these endpoints, so no CHANGELOG or description change. Neither the console nor the admin app reads the code for this field (the console has no single session editor; the admin app's schedule screen sends no `endsOn` and maps issues by path only).
- Tests: `@qc/api` 554 passing in 27 files (1 new for the schedule change; the create test now asserts the code and that the same day is accepted).

## Done (2026-10-17: contract 1.0.0-rc.3)

- Invites return `replacesAssignmentId` (null for a plain invite) on `adminRoles.invite` and `adminRoles.invites`. A resend that names the link carries it, including for a lapsed invite; a resend of a pending handover invite without it keeps the link only while the replaced assignment is still live (a stale one is dropped). An ended or unknown link sent explicitly is still `not_found`, and the pending invite is left as it was.
- Import: a unique-index race between the check and the write answers 409 `conflict` (was 400 `validation_failed` with the unlisted issue `changed_during_import`). `invalid_range` on session rows is now a contract code.
- Scoped export: an unknown `venueId` or `cityId` answers `not_found` (`ctx.unknownRef`) to anyone holding `registration.export` (was 403 for an unknown venue and an empty file for an unknown city); outsiders still get 403 first, a known place out of scope is still 403.
- ADR 0011 updated: unknown ids in the path, body or query answer `not_found` to role holders and `forbidden` to outsiders; the old `validation_failed` wording is gone.
- Tests: `@qc/api` 553 passing in 27 files (11 new: 6 roles for the handover on the invite response, resend carry-over and every caller role; 4 import for `invalid_range` and the `conflict` race on each kind; 1 export for unknown ids by every role). Typecheck, eslint and prettier clean on the changed files.

## Done (2026-10-17: contract 1.0.0-rc.2, migration 0008)

- Daily occurrence top-up moved to `@qc/db` (`packages/db/src/jobs/`); `modules/sessions/top-up.ts` and `jobs.ts` re-export `topUpAllOccurrences`, and the worker now runs it daily. The lazy per-session path still uses `modules/sessions/occurrences.ts`, a copy of the package's planner (switching it to `@qc/db` is a follow-up).
- Settings: `reminderLeadMinutes {dora, circles}` (default 60 each) stored under `reminder_lead_minutes`, the key the worker reads. A PATCH with one program merges with the stored value.
- `users.display_name` is nullable: nothing writes the `-` placeholder any more; readers treat null, blank and a legacy `-` as no name (`modules/shared/names.ts`).
- Circles: `adminCircles.decide` takes no note and audits `{}`; `adminCircles.update` accepts `status` `published` <-> `archived` only (anything else is `validation_failed` `{path: 'status', code: 'invalid_transition'}`); `adminCircles.get` returns the list entry, `not_found` outside the caller's list scope.
- Sessions: `adminSessions.get` returns the list entry, `not_found` outside scope. Unknown circle, season or venue in `adminSessions.create` answer `not_found`.
- Body references to unknown ids answer `not_found` to callers who hold a qualifying role and `forbidden` to everyone else (`ctx.unknownRef(action)`), on circles, sessions, roles, updates, registrations and follows. `me.delete` by the last national admin answers 409 `last_national_admin`.
- Handover by invite: `adminRoles.invite` stores `replacesAssignmentId` after checking it is a live assignment for the same role and place (else `not_found`). A second invite for the same number, role and place is a resend: the pending one is revoked, a new one with a fresh expiry is created and its WhatsApp invitation queued (the handover is carried over). Acceptance (auth lane) revokes the old assignment in the same transaction, with a `role.revoke` audit row.
- `adminImport.venues|sessions|coordinators` (`modules/import/`): `checkImportRows`, then reference, `area_not_in_city` and per-row `forbidden` checks (scope first, so an outsider never learns whether an id exists), then duplicates against the database and earlier rows (keys as the contract describes them). Applied all or nothing in one transaction only when not a dry run and no row is invalid; one `import.<kind>` audit row with counts only; coordinator invitations are queued after the commit. A caller with no qualifying role anywhere gets 403.
- `adminRegistrations.export` (`modules/registrations/export.ts`): scoped by `registration.export`, filters `cityId`, `venueId`, `from`, `to` (inclusive Pakistan dates of `registered_at`), cancelled rows left out, more than 50,000 rows is `validation_failed` `too_many_rows`, built with `csvFile`/`csvLine`/`csvCell` (no BOM), one audit row with the filters and the row count.
- `adminUpdates.preview`: same validation and scope as post, returns `{recipients}`, writes and sends nothing.
- Outbox rows carry `venue_id` (registration confirmations, waitlist offers, venue update pushes, session change WhatsApp, coordinator invites).
- `ctx.scope(action)` now refuses only callers with no qualifying role and returns the filter, so it serves city- and venue-level actions (the scoped export) as well as list actions. New `ctx.qualify(...actions)` for item-by-item requests.
- `apps/api/src/jobs.ts` exports `topUpAllOccurrences(db, now, horizonDays)` (new, caps at the session's and the season's last day) and `purgeStaleAuthRows`, for a worker to call without importing the HTTP app.
- Tests: `@qc/api` 542 passing in 27 files (new `import.test.ts` 13, `export.test.ts` 8; scope matrix now covers every staff endpoint including the seven new ones, 51 tests). Typecheck, eslint and prettier clean on the lane paths.

## Done (earlier)

- Every endpoint in the `@qc/contracts` `endpoints` registry except the four `auth.*` ones is served by a real handler: 69 endpoints (registry total 73). The contract test asserts that the mounted routes equal the registry minus `auth.*`, so a registry addition without a handler fails CI.
- Each endpoint has the exact method and path, a validated request (params, query, body), a response parsed by the registry schema, contract error codes only, a stable `x-request-id`, and an in-memory rate-limit hook per `rateLimit` bucket.
- Registry-driven route binder in `apps/api/src/modules/shared/route.ts`. Handlers never check roles by hand: they call `ctx.authorize`, `ctx.scope`, `ctx.missing`, `ctx.unknownRef` or `ctx.allowed`. A staff handler that never decides fails closed. Design record: `docs/engineering/decisions/0011-api-core-route-binder.md` (status proposed; the decisions README index is not updated, the orchestrator may add it).
- Modules: `system` (health, config, content), `me` (profile, consents, follows, devices, bookmarks, reading position, circle requests), `places`, `venues`, `sessions` (public and admin, occurrences, schedule changes), `registrations` (waitlist, CSV export), `updates` (feed, unread count, post, templates list), `circles`, `roles` (invites, assignments), `attendance`, `oversight` (audit), `settings`.
- Middleware: request id, structured logger (never logs phone numbers, names or message bodies; UUIDs are not redacted), rate limiter, auth adapter and `authLane(deps)` integration in `middleware/auth-lane.ts`.
- `app.ts` (`createApp` with `mount` and `authFailure`), `index.ts` (real server on node-postgres), `db.ts` (common `Db` type over node-postgres and PGlite).
- Tests (Vitest with PGlite and the real migrations, injected fake clock): 282 tests in the api-core files. The whole `@qc/api` package ran 483 passing in 25 files at the last full run (the rest are the auth lane's). Suites: contract (18), scope matrix (40), sessions (28), me (36), roles (26), updates (24), registrations (22), attendance and oversight (22), circles (19), places and venues (16), middleware (15), client (6), auth wiring (9, with the real auth lane), plus the existing `/health` test.
- `auth-wiring.test.ts` runs the real auth lane through `createApiClient`: sign-in, `token_expired` then refresh, forged token, suspended account, sign-out, role changes taking effect immediately, invite turning into a role at sign-in. `client.test.ts` covers the typed client against the real app. There is no mock-server parity run.
- i18n: three `notifications.*.title` keys added to `packages/i18n` (en and ur together).
- Dependencies added with `pnpm --filter @qc/api add` (pinned): `drizzle-orm 0.45.4`, `jose 6.2.12`, `pg 8.23.1`, `zod 4.6.7`, `@hono/node-server`; dev: `@electric-sql/pglite 0.5.10`, `@types/pg 8.23.1`, `tsx`.
- Last verified: `pnpm --filter @qc/api typecheck` clean, contract test green, eslint and prettier clean on the lane paths.

## Design notes

- Error policy. `missing(action)` answers `forbidden` for people with no qualifying role and `not_found` for staff (only on endpoints with params). `unknownRef(action)` is for body fields that point at nothing: `forbidden` for outsiders, `not_found` for anyone holding a qualifying role. Since rc.3 the scoped export follows the same rule for its `cityId` and `venueId` filters. `conflict` is returned only where the contract declares it.
- A handover whose `replacesAssignmentId` names an assignment at another place, or a revoked one, answers `not_found` (the same as unknown), so a coordinator learns nothing about other places. Replacing yourself is `validation_failed` on `replacesAssignmentId`.
- `adminUpdates.list` reports `recipients` as the current reach (the number is not stored per post).
- Attendance `markedAt` is derived (no column).
- Programs are upserted lazily, so no seed is needed.
- Roles, invites and account deletion overlap with the auth lane (sign-in consumes invites; deletion cascades). The handlers share the tables and the role-resolution helpers.

## In progress

- Nothing.

## Blocked

- Nothing blocking. The items under "Questions" and the change requests need decisions in other lanes.

## Questions for the orchestrator

- `purgeStaleAuthRows` (`apps/api/src/jobs.ts`) is still not scheduled by the worker; it would need the same move into a shared package.
- The lazy per-session `topUpOccurrences` on the public occurrences view and `insertSession` still ignore a season's last day (pre-existing); only the daily job caps at it.
- Import duplicate keys follow the contract text and the mock (venue: city + English name, case-insensitive; session: venue + English title + kind + start time + days or date; coordinator: number + role + place, or a person who already holds it), not the brief's wording (venue by city + area + name, session by venue + weekday + time). Say if the brief's keys are wanted.
- `message_templates` rows are not seeded by the API. `adminTemplates.list` returns what is in the table.
- `index.ts` environment variables: `DATABASE_URL` (required), `PORT` (default 3000), `CORS_ORIGINS` (comma list), `TRUST_PROXY=true`, `PUBLIC_WEB_BASE`, plus the auth lane's `APP_ENV`, `AUTH_SECRET`, `AUTH_FIXED_CODE`, `AUTH_TRUST_PROXY` and the `@qc/messaging` provider variables.

## Contract change requests

- Applied in api-core 2026-10-17: `auth-failure-reason`, `api-core-contract-gaps` (items 1 to 3), `console-bulk-import`, `console-export-scope`, `console-user-lookup-handover`, `reminder-lead-setting`, `users-display-name`, `outbox-venue-and-provider-id`, `admin-app-contract-notes` (items 1 and 2), `console-contract-ergonomics` (item 4, resend).

## Findings from integration

From the WP11 end-to-end run against the real API (details in `tests/e2e/FINDINGS.md`):

- F-01 (high, **fixed 2026-10-17** by the orchestrator's decision: `pnpm --filter @qc/db bootstrap-admin --phone <E.164>` in `packages/db`, see the contracts status; the e2e suite now uses it): no supported way to create the first national admin; a fresh database cannot be administered. Needs an orchestrator decision (a CLI in `packages/db` or `apps/api`). The e2e suite inserts a pending national invite with SQL.
- F-02 (medium, **fixed 2026-10-17**): every `Promise.all` that can run on a transaction handle is now sequential: `sessions/views.ts` (`loadSessions`), `updates/publish.ts` (`sessionAudience`), `updates/reach.ts` (`venueConnectedUserIds`, `cityUserIds`, `connectedScopes`), `me/profile.ts` (`getMe`), `me/follows.ts` (`toFollows`), `import/service.ts` (`checkVenues`, `checkSessions`). Only `system/service.ts` `getConfig` keeps `Promise.all` (pool only, commented). The API test harnesses (`test/harness.ts`, `auth/testing/harness.ts`) wrap PGlite with `guardTransactions` from `@qc/db/testing`, so any overlap inside a transaction fails the test (33 tests failed before the fix); `test/tx-guard.test.ts` keeps the guard on. `@qc/api`: 556 tests. Original note: overlapping queries on one transaction client (`DeprecationWarning: Calling client.query() when the client is already executing a query`, an error from pg 9) during `POST /v1/registrations` and `POST /v1/admin/sessions/:id/schedule`. Candidates: `Promise.all` on the transaction handle in `modules/sessions/views.ts:62`, `modules/updates/publish.ts:209`, `modules/updates/reach.ts`. Not visible under PGlite.
