# Status: data (circles data load)

Updated: 2026-10-26
Branch: lane/data/tanzeem-seed

## Done

- Read the console import path (`apps/console/src/import/`), the import API module, the db seed, and the places and programs schema.
- Change request `2026-10-26-venue-coordinates-optional.md` (owner chose option A: make venue coordinates optional, then import through the app's own path).

## In progress

- Generic importer and rollback tooling that reads an external file at run time (no real data in the repo).

## Blocked

- Cleaned source files: path not yet supplied. Nothing is written to any database.
- Production: needs the production API address or database access, a backup, a dry run the owner has seen, and the owner's go-ahead.
- Venue import cannot take rows without coordinates until the contracts lane applies part 1 of the change request.

## Questions for the orchestrator

- Session timing (prayer-relative and monthly circles): keep a documented placeholder, or add contract fields (part 2 of the change request)?
