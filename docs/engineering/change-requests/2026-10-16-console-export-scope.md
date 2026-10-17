# Change request: export a venue or a city, with dates, in one audited call

Requested by: console
Contract: endpoints (`registrations.export` and a new sibling)
What I need: `GET /v1/admin/registrations/export?cityId=&venueId=&from=&to=` returning one CSV (`text/csv`), with a single audit row that records the filters and the row count.
Why: `registrations.export` only takes one session. The console's Exports page lets a person choose a session, a venue or a city, so for a venue or city it calls the per-session export once for each session and joins the files in the browser with a leading `session_id` column. That works, but it makes one audit row per session instead of one for what the person actually asked for, it can half-finish (the console saves nothing in that case), and it cannot filter by date range as the screen spec (`console-exports.md`) asks.
Proposed change: add the endpoint with the same scope check as `registration.export` for every row, a hard row cap, and CSV writing on the server that neutralises cells starting with `=`, `+`, `-`, `@` (spreadsheet formula injection) in names. The file is UTF-8; the console adds a byte order mark when saving so Excel reads Urdu correctly (the server may add it instead).
Also: the spec's Attendance export and the "recent exports" history are not in the P0 contract. If wanted, add `attendance.export` and list exports from the audit log with `entityType=export`.
Affected lanes: contracts, api-core, console.
Workaround meanwhile: fan-out over per-session exports, merged only when all succeed. No attendance option, no history table (the Audit log page shows export entries).

Applied 2026-10-17 in contract 1.0.0-rc.2 / migration 0008.

Applied in console 2026-10-17: the Exports page uses `adminRegistrations.export` for a venue or a whole city with From and To dates, one call and one audit row; the per-session fan-out and merge are removed. The byte order mark is still added when saving. An empty file is reported, not saved; `too_many_rows` and refused dates are shown at the right place. Attendance export and the recent-exports history are still not built (not in the contract).

Applied in api 2026-10-17: `adminRegistrations.export` with `cityId`, `venueId`, `from`, `to` (inclusive Pakistan dates), scoped by `registration.export`, refused over 50,000 rows with `too_many_rows`, no byte order mark, one audit row with the filters and the row count.
