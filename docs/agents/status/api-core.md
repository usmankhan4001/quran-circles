# Status: api-core

Updated: 2026-10-17
Branch: claude/peaceful-archimedes-ain95k

## Done (2026-10-17: contract 1.0.0-rc.2, migration 0008)

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

- Error policy. `missing(action)` answers `forbidden` for people with no qualifying role and `not_found` for staff (only on endpoints with params). `unknownRef(action)` is for body fields that point at nothing: `forbidden` for outsiders, `not_found` for anyone holding a qualifying role. The export has no `not_found` in the contract, so an unknown `venueId` there is refused like one out of scope (403). `conflict` is returned only where the contract declares it.
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

- Worker wiring of the daily jobs: `apps/api/src/jobs.ts` is ready, but `@qc/worker` cannot import it without adding `@qc/api` as a workspace dependency (a `pnpm-lock.yaml` change, outside my paths). Either add the dependency and a daily schedule in the worker, or move the job into a shared package.
- The lazy per-session `topUpOccurrences` on the public occurrences view and `insertSession` still ignore a season's last day (pre-existing); only the daily job caps at it.
- Import duplicate keys follow the contract text and the mock (venue: city + English name, case-insensitive; session: venue + English title + kind + start time + days or date; coordinator: number + role + place, or a person who already holds it), not the brief's wording (venue by city + area + name, session by venue + weekday + time). Say if the brief's keys are wanted.
- Import issue codes beyond the contract's list: `invalid_range` (session `endsOn` before `startsOn`) and, on the request, `changed_during_import` when a unique index trips between check and write.
- `message_templates` rows are not seeded by the API. `adminTemplates.list` returns what is in the table.
- ADR 0011 still describes the old `unknownRef` (validation_failed for staff); it should say `not_found`. I did not edit it.
- `index.ts` environment variables: `DATABASE_URL` (required), `PORT` (default 3000), `CORS_ORIGINS` (comma list), `TRUST_PROXY=true`, `PUBLIC_WEB_BASE`, plus the auth lane's `APP_ENV`, `AUTH_SECRET`, `AUTH_FIXED_CODE`, `AUTH_TRUST_PROXY` and the `@qc/messaging` provider variables.

## Contract change requests

- Applied in api-core 2026-10-17: `auth-failure-reason`, `api-core-contract-gaps` (items 1 to 3), `console-bulk-import`, `console-export-scope`, `console-user-lookup-handover`, `reminder-lead-setting`, `users-display-name`, `outbox-venue-and-provider-id`, `admin-app-contract-notes` (items 1 and 2), `console-contract-ergonomics` (item 4, resend).
