# Status: db

Updated: 2026-10-25 (migration 0013, message template catalog; withSeasonEnd)
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits)

## Done (2026-10-25: migration 0015, email sign-in)

- `0015_email_sign_in` (with down): `users.email` / `email_verified_at`, `phone_verified_at` nullable, `users_identity_chk`; `otp_challenges.email` / `claimed_phone_e164`, `phone_e164` nullable, target check; `coordinator_invites.email`; `bootstrap-admin --email`. Phone users unchanged.

## Done (2026-10-25)

- **Migration 0014 `poster_template_catalog`** (owner's request, from the poster maker): writes the renderer's three templates (`cloud`, `night`, `quranic_circles`) with the fixture ids; before, only the dev seed wrote `poster_templates`, so the console on a live database had no template to pick. Idempotent (`ON CONFLICT (key) DO NOTHING`); down removes rows no poster uses. Tests: `src/poster-templates.test.ts` (parity with `DEMO_POSTER_TEMPLATES`, fails when a template is added without a migration), `migrate.test.ts` +1 describe, `seed.test.ts` (the seed finds the three rows already there). Change request `docs/engineering/change-requests/2026-10-25-halaqa-flyer.md`.

- **Migration 0013 `message_template_catalog`**: writes the contract template catalog (`TEMPLATES`, 8 keys x en/ur) in every environment; before, only the dev seed wrote it and production had none, so `GET /v1/admin/message-templates` was empty. English rows `approved` (approved by nobody, `approved_at` now), Urdu `draft` until reviewed. Idempotent: existing rows kept; a seeded English draft with the catalog wording is marked approved. Down removes the catalog rows nobody approved by hand. The seed no longer writes templates. Tests: `src/message-templates.test.ts` (parity with the contract: fails when `TEMPLATES` changes without a new migration), `migrate.test.ts` +1 describe, `seed.test.ts` updated. Note: the catalog still has the booking templates (`registration_confirmation`, `waitlist_promoted`); the join-pledge work will need a new migration when it changes `TEMPLATES`.
- **`withSeasonEnd(spec, seasonEndsOn)`** in `src/jobs/occurrences.ts`, exported from `@qc/db`: one rule for "a session in a season stops at the season's last day", used by the daily top-up and the API. Tests in `jobs/top-up.test.ts`.
- `@qc/db` 247 tests.

## Done

- 2026-10-18 (Gate 5 database performance, orchestrator brief; new migration and index only): **migration 0012 `occurrence_start_floor`**: partial index `occurrences_multiday_starts_idx` on `occurrences (starts_at) WHERE ends_at - starts_at > interval '1 day'`. It holds only occurrences an organiser stretched past a day (none are generated that long; a session lasts 1 to 1,440 minutes), so it is tiny, and it gives the API an exact lower bound on `starts_at` for "still running at or after now" reads, which no longer walk every past occurrence (`status/api-core.md`). Additive, no data change; the down migration drops the index and is safe at any time. Schema: the index on `occurrences` in `schema/programs.ts`. Tests: `migrate.test.ts` +1 describe (it is the twelfth migration; applies on top of 0011 with occurrences in place, keeps them and, with sequential scans off, reads exactly the multi-day one through it; adds exactly that index with that predicate; the API's lookup uses it after the migration and not before; down and up again). `@qc/db` 238 tests in 10 files.
- 2026-10-18 (load test, api-core finding; applied with the orchestrator's go-ahead, new migration only): **migration 0011 `update_push_fanout`**: `updates.push_pending_since timestamptz NULL` and the partial index `updates_push_pending_idx` (`WHERE push_pending_since IS NOT NULL`). Additive; the down migration drops both (a fan-out still pending is lost, so run the worker dry first). Schema: `pushPendingSince` on `updates` in `schema/messaging.ts`. New job `src/jobs/update-push.ts`, exported from `@qc/db`: `reachUserIds`, `venueConnectedUserIds`, `UpdateScopeRef` (moved unchanged from the API), `updateScopeOf`, `updatePushPayload`, `updatePushKey`, `writeUpdatePushes`, `fanOutPendingUpdatePushes(db, { limit, chunkSize, webBase })` (one transaction per update, `FOR UPDATE SKIP LOCKED`, chunks of 1,000, `ON CONFLICT DO NOTHING` on the idempotency key, then the mark cleared), `countPendingUpdatePushes`, `UPDATE_PUSH_CHUNK`. Tests: `src/jobs/update-push.test.ts` (9: who gets a row and its exact fields, idempotent reruns, unmarked updates, oldest first and `limit`, chunking, a failing insert rolls the update back and keeps the mark, two workers at once, a venue update's reach, the reach count) and `migrate.test.ts` +1 (0011 adds exactly the column and index, rolls back and forward). `@qc/db` 235 tests in 10 files.
- 2026-10-18 (SEC-05): no schema or migration change. Account deletion (`apps/api/src/modules/me/profile.ts`, api-core) now deletes the person's rows in `legacy_registrations` and `legacy_whatsapp_subscribers` by `phone_raw` = the account's E.164 number, every season, in the deletion transaction. Details and tests in `status/api-core.md`.

## In progress

- Nothing.

## Blocked

- The legacy retention rule below needs the owner's dates before a purge job is written.

## Questions for the orchestrator

- Approve the retention proposal below, or give the owner's dates.
- Index: neither legacy table has an index whose leading column is `phone_raw` (the subscriber unique key leads with `season_tag`), so the delete scans both tables. They hold one season of V1 data (thousands of rows), so this is fine; add `(phone_raw)` indexes in a new migration only if a second season is imported.

## Proposal: retention for the V1 legacy tables (SEC-05, not implemented)

Neither table has a retention rule today. `docs/product/decisions.md` keeps personal data "until the person deletes their account", but V1 registrants never made a V2 account, so without a rule their name and number stay for ever.

| Table                         | What it is for                                                                    | Proposed rule                                                                                                                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legacy_whatsapp_subscribers` | The re-consent campaign (rows are `needs_reconsent`; no consent was carried over) | Delete every row **6 months after the migration's apply date**, or when the re-consent campaign ends, whichever is first. A number that consents in V2 has its own `consents` row; its legacy row can go at once.                   |
| `legacy_registrations`        | Reference for Ramadan 2026 (who came where), and season-on-season comparisons     | Delete every row **after Ramadan 2027 (proposed: 2027-04-30)**. If comparisons are wanted later, keep only counts per season, city and venue (no names or numbers) in a new table first, written by the same job before it deletes. |

How it would be built (once the dates are set):

- A purge job in `packages/db/src/jobs/legacy-purge.ts`, beside `purgeStaleAuthRows`: `purgeLegacyRows(db, now, { subscribersUntil, registrationsUntil })` deletes all rows of a table once `now` is past its date (rows hold no reliable timestamp of their own: `registered_at` is V1's and may be null, and `legacy_whatsapp_subscribers.created_at` is the import time, so a per-table cut-off date is simpler and safer than a per-row age). Returns counts only; logs counts only.
- The worker schedules it daily (as for the auth purge). The two dates come from settings or environment, with no default that deletes anything, so the job is a no-op until the owner sets them.
- Tests with PGlite: nothing deleted before a date, everything in that table deleted after it, the other table untouched, counts returned, no names or numbers in logs.
- Backups: deleted rows stay in encrypted backups until those age out (SEC-19); the backup retention is the upper bound and should be stated next to these dates.
- Data-migration lane to confirm: a re-run of the migration tool after the purge must not re-import the rows (it reads V1, so it would). Either retire the tool after launch or have it refuse to run past the subscriber date.
