# Status: db

Updated: 2026-10-18 (security review SEC-05)
Branch: claude/peaceful-archimedes-ain95k (orchestrator commits)

## Done

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
