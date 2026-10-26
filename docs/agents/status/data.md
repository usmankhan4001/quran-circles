# Status: data (circles data load)

Updated: 2026-10-26 (local seed done)
Branch: lane/data/tanzeem-seed

## Done

- Read the console import path (`apps/console/src/import/`), the import API module, the db seed, and the places and programs schema.
- The change request to make venue coordinates optional was withdrawn by the owner (map pins need them). Contracts are unchanged.

## Decisions (owner)

- Every venue gets real lat/lng before import. Sources, in order: (1) the row's map link, resolved at run time on the owner's PC (short links followed, coordinates parsed); (2) geocoding the address, only after the owner picks the service; (3) otherwise the row goes into a "needs location" report and is not imported until a coordinator or the owner pins it in the console location picker. Coordinates are never guessed.
- Resolved pins are checked against their stated city (bounding box); a pin far from its city is flagged, not imported.
- Prayer-relative and monthly circles use a documented placeholder time, with the original wording in the session description.
- No real data in the repository. The data file is passed at run time from outside the repo.

## Done (tool)

- `tools/circles-load` (`@qc/circles-load`): `report` command. Cleans the circles CSV (days, weeks of month, times, +92 phones), skips exact repeats, holds probable typos and wrong-city addresses, resolves map links (Google hosts only, redirects by hand), reads coordinates and plus codes from notes, rejects shared or far-off pins, and prints counts. Never writes to a database. 45 tests on synthetic rows.

- Geocoding step (Google, owner's key kept outside the repo in a local env file), approximate pins flagged (owner chose to import them as test data), and the builders that turn planned venues and rows into API import rows, validated against the real contracts. 62 tests.

- `places` (idempotent SQL for provinces, 42 cities, one area per city), `load` (email sign-in, venues then sessions through `adminImport.*`, dry run first, manifest of created ids) and `unload` (archives the manifest). Run on the owner's PC against a local Postgres: 42 cities, 167 venues (75 flagged approximate), 172 sessions (33 monthly drafts), 2236 occurrences; public `places.cities` lists 42.

- `export` writes the console import files (venues.csv, sessions.csv) from the plan. First-admin-from-env built on `lane/auth/admin-bootstrap` (see `status/auth-scopes.md`).

## In progress

- Nothing in this lane; production steps wait on the owner.

## Blocked

- Cleaned source files: path not yet supplied.
- Cities and areas: the API has no endpoint to create them, so the 42 cities and their areas must already exist in the target database (a db seed or migration, contracts lane).
- Geocoding service: owner has not chosen one.
- Production: the owner approved the counts and the seed. The PC permission layer refuses every production write from the agent (Dokploy API schedule, Dokploy UI env edit, push to main). The owner has the copy-paste steps (backup, places SQL, admin invite, `load` from the PC against the live API, verify, `unload`).
