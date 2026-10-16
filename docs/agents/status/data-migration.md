# Status: data-migration

Updated: 2026-10-16
Branch: claude/peaceful-archimedes-ain95k

## Done

- `tools/migration/` (`@qc/migration`): read-only exporters, place-mapping proposal, cleaning and dedupe, dry run and apply, per-city counts report, verification. Runbook in `tools/migration/README.md`.
- Dry run is the default; `--apply` needs the plan fingerprint from the reviewed dry run. One transaction, rollback on any error, idempotent (second apply inserts nothing).
- Registrations go to `legacy_registrations` tagged `ramadan-2026`; WhatsApp subscribers to `legacy_whatsapp_subscribers` with `needs_reconsent = true`; push subscriptions and accounts are not carried.
- Pure bookmark helper `@qc/migration/bookmarks`.
- Tests: 311 passing (PGlite with the real migrations): phone formats and bad inputs, city and venue mapping, dedupe, idempotency, dry-run versus apply parity, rollback on injected failure, no names or phones in report or output. Also run end to end against a scratch Postgres 16 with the synthetic fixtures (dry run, apply, verify, re-run shows nothing new); the scratch database was dropped.
- Decision record 0004. Synthetic fixtures in `tools/migration/fixtures/`; no real data or secrets anywhere.

## In progress

- Nothing.

## Blocked

- Real run needs the owner's supervision: V1 connection variables, a human-reviewed mapping CSV, and the real V2 city and area seed.

## Questions for the orchestrator

- Where will the real city and area list be seeded? The tool never creates cities; areas only with `--create-areas`.
- Is skipping registrations whose venue is unmapped or ambiguous acceptable, or should they be carried with a null venue?
- Should `legacy_whatsapp_subscribers` get a unique key and a city column (change request below)?
- Where should the bookmark helper live (change request below)?
- Urdu venue text is filled with the English text and counted; confirm that is acceptable until the content lane translates it.
- `docs/engineering/decisions/README.md` index is not mine; add 0004 there if the index lists records.

## Contract change requests

- docs/engineering/change-requests/2026-10-16-legacy-subscriber-keys.md
- docs/engineering/change-requests/2026-10-16-bookmark-import-home.md
