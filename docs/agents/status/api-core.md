# Status: api-core

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k

## Done

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

- Error policy. `missing(action)` answers `forbidden` for people with no qualifying role and `not_found` for staff in scope (only on endpoints with params). `unknownRef(action, path)` is for body fields that point at nothing: `forbidden` for outsiders, `validation_failed` with `{path, code: 'invalid_reference'}` for staff. `conflict` is returned only where the contract declares it (`follows.create`, `bookmarks.create`, `adminRoles.invite`).
- `adminUpdates.list` reports `recipients` as the current reach (the number is not stored per post).
- Attendance `markedAt` is derived (no column). The circle decision note is not stored and circles cannot be archived (no column or state).
- `me.delete` for the last national admin returns `validation_failed` with issue code `last_national_admin` because the contract does not list a dedicated code.
- Display name placeholder `'-'` matches `UNNAMED_DISPLAY_NAME` used by the auth lane.
- Programs are upserted lazily, so no seed is needed.
- Roles, invites and account deletion overlap with the auth lane (sign-in consumes invites; deletion cascades). The handlers share the tables and the role-resolution helpers; there is no code duplication of the sign-in path.
- Reminder lead settings: only the four settings fields in the current contract are supported. The `reminder-lead-setting` change request needs a contract change first.

## In progress

- Nothing.

## Blocked

- Nothing blocking. The items under "Questions" and the change requests need decisions in other lanes.

## Questions for the orchestrator

- Operations to schedule outside the API process: a daily worker must call `topUpOccurrences` across all sessions to keep the 90-day occurrence horizon filled. Today it runs lazily per session on the public occurrences view only.
- `message_templates` rows are not seeded by the API. `adminTemplates.list` returns what is in the table, so ops or the messaging lane must seed it.
- Should the decisions README index list record 0011? I did not edit it.
- `index.ts` environment variables: `DATABASE_URL` (required), `PORT` (default 3000), `CORS_ORIGINS` (comma list), `TRUST_PROXY=true`, `PUBLIC_WEB_BASE`, plus the auth lane's `APP_ENV`, `AUTH_SECRET`, `AUTH_FIXED_CODE`, `AUTH_TRUST_PROXY` and the `@qc/messaging` provider variables.
- Other lanes filed change requests that touch api-core and need contract changes before I can serve them: `2026-10-16-console-export-scope.md`, `2026-10-16-console-user-lookup-handover.md` (and `replacesAssignmentId`), `2026-10-16-reminder-lead-setting.md`, `2026-10-16-users-display-name.md`. I did not implement any of them.

## Contract change requests

- `docs/engineering/change-requests/2026-10-16-auth-failure-reason.md`: the auth lane should export a reader for why a request has no principal. Workaround in place: `authLane` probes `requireAction('me.read')` and parses the refusal body.
- `docs/engineering/change-requests/2026-10-16-api-core-contract-gaps.md` (five items): `me.delete` should list `last_national_admin`; body references to unknown ids have no honest code (served as `validation_failed` / `invalid_reference`); circle archive and decision note have no column; `PostedUpdate.recipients` is not stored; attendance `markedAt` has no column.
