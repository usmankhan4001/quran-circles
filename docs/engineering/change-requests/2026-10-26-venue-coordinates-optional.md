# Change request: venue coordinates optional, and session timing the real circles need

Requested by: data (circles data load, owner request 2026-10-25/26)
Contract: API (`VenueCreate`, `VenueUpdate`, venue read shapes) and schema (sessions)
What I need: venues can be created, imported and shown without a map position, and the owner's real circle list can be loaded through the app's own import path.
Why: the owner has the real list of about 189 circles in 42 cities. Almost none of the rows have coordinates. `VenueCreate` (`packages/contracts/src/schemas/admin.ts`) and the console venue import (`apps/console/src/import/venues.ts`) require `lat` and `lng` on every row, so the import path refuses the list. The database columns `venues.lat` and `venues.lng` are already nullable, so no column changes.

Proposed change, part 1 (needed now, owner chose this on 2026-10-26):
- `VenueCreate.lat` and `lng`: `Latitude.nullable().default(null)` and the same for `Longitude`. Both or neither (a row with one coordinate is invalid).
- `VenueUpdate`: allow `null` to clear a position.
- Venue read shapes (`Venue`, `AdminVenue`, public places and nearby): `lat` and `lng` become nullable where they are not already. Nearby and distance sorting must skip venues without a position (they appear in the list view and the city or area browse, not on the map and not in "near me").
- Console import: `lat` and `lng` columns become optional. The area column stays required; a city with no matching area is reported as `unknown_area`.
- Regenerate `openapi.json`, update the mock fixtures, add tests (import with and without coordinates, one coordinate only, nearby ignoring unpositioned venues).

Proposed change, part 2 (not blocking the venue load; a decision for the owner and the orchestrator):
- Sessions today take a weekday list and one wall-clock `localStartTime`. The source has prayer-relative starts ("After Maghrib") and monthly patterns ("weeks of month"). Until a contract adds a prayer anchor and a week-of-month rule, the load uses a documented placeholder time and puts the original wording in the session description. Options: (a) keep the placeholder; (b) add optional `startAnchor` (`{ prayer, offsetMinutes }`) and `weeksOfMonth` to `SessionCreate` and the sessions table (new migration).

Affected lanes: contracts (owner of `packages/contracts` and `packages/db`), api-core (places and import modules), console (venue import), user-app and admin-app (venue display and nearby when there is no position).
Workaround meanwhile: nothing is written to any database. The importer, the dry run and the tests are built on synthetic rows. No real data is committed to the repo; the data file is passed at run time from outside the repo.
