# Status: data (circles data load)

Updated: 2026-10-26
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

## In progress

- The dry run through the API, the batch manifest, and the rollback (archive exactly what was imported). Needs the API address and a sign-in.

## Blocked

- Cleaned source files: path not yet supplied.
- Cities and areas: the API has no endpoint to create them, so the 42 cities and their areas must already exist in the target database (a db seed or migration, contracts lane).
- Geocoding service: owner has not chosen one.
- Production: needs API address and sign-in, a backup, a dry run the owner has seen, and the owner's go-ahead.
