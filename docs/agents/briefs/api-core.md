# Brief: api-core

Lane: api-core
Work packages: WP2 (Wave 2), WP19 API part (Wave 7)
Wave: 2
Priority: P0
Approval: reviewer agent, plus a human for sensitive modules named below

## Goal

Implement the API against the frozen contract: places and venues, sessions and occurrences, circles, registrations and consents, follows, the Updates feed, devices, attendance, and the audit log. The result passes the contract tests against the real database.

## You own

`apps/api/src/app.ts`, `apps/api/src/index.ts`, `apps/api/src/modules/` (everything except `auth`), `apps/api/src/middleware/`.

## You must not touch

`apps/api/src/auth/` and `apps/api/src/modules/auth/` (auth-scopes lane), and `packages/*`.

## Read first

`docs/product/data-model.md`, `docs/product/messaging.md`, `docs/product/features.md`, the frozen `packages/contracts` and `packages/db`, `docs/engineering/conventions.md`.

## Deliverables

1. **App composition.** Route mounting, an error handler that maps to the contract's error codes, request ids, structured logging with personal-data redaction, CORS for the apps and the console, rate-limit middleware.
2. **Places and venues.** List with filters (city, area, text), venue detail with facilities. Create and edit venue, scope-checked and audited.
3. **Sessions and occurrences.** List with filters (day and time, section, language, area). Generate occurrences from recurring schedules. One-off lectures. Changing a session time writes an audit row and enqueues a "session changed" message in the outbox.
4. **Circles.** Create by a venue coordinator, pending, approve by the city coordinator, published; edit and archive.
5. **Registrations.** Create with required-field validation, capacity and waitlist when enabled, cancel, list mine, list for a session in scope, CSV export in scope. Capture consent at registration. Enqueue the confirmation in the outbox.
6. **Follows and consents.** Per-venue alerts and consent records.
7. **Updates and feed.** Post within scope. Feed by the reach rule (national to everyone; city and venue to connected people). Unread counts and mark-read.
8. **Devices.** Register and remove push tokens and web push subscriptions.
9. **Attendance.** Headcount plus optional names for an occurrence, in scope. Portion and recap on occurrences (for WP17 in Wave 4).
10. **Profile.** Bookmarks, reading positions, and the Hijri offset setting (national admin only).
11. **Audit.** An audit row for every admin and coordinator write.
12. **Wave 7.** Circle requests and the demand queries (WP19).

## Definition of done

- Every endpoint in the contract is implemented with schema validation on input and output.
- Handler tests cover the happy path and the failure paths.
- Every scope check goes through `authorize()`. No handler checks roles by hand.
- The contract tests pass between the real API and the mock.
- Sensitive modules (registrations export, anything that returns phone numbers) have a human approval.

## Commands that must pass

```sh
pnpm check
docker compose -f infra/docker-compose.dev.yml up -d
pnpm --filter @qc/api test
```

## Decisions to respect

Registrations carry area, section and party size as required fields. Coordinators see registrants' numbers; attendees see only the venue's contact number. Drop-in attendance is a headcount plus optional names. Teacher is a name field. Time is stored in UTC and shown in Pakistan time.

## Stand-ins

Auth not ready: use the test-only `authorize()` stub from the contract's interface, clearly marked and enabled only when `NODE_ENV=test`. Messaging not ready: write to the outbox and stop there.
