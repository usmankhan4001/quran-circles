# Brief: data-migration

Lane: data-migration
Work packages: WP9
Wave: 2
Priority: P0
Approval: human, for the whole lane

## Goal

Move V1's venues and past registrations into the V2 database safely and repeatably, and give the owner a per-city report to check before launch. V1 stays live and is never written to.

## You own

`tools/migration/`.

## You must not touch

Everything else. You use `@qc/db` and `@qc/contracts` as they are.

## Read first

`docs/product/decisions.md` (migration), `docs/product/data-model.md` (legacy tables, places), `docs/engineering/conventions.md`. For the V1 shapes: `services/programs.ts`, `supabase/seed.sql`, `src/data/staticPrograms.ts` and `components/ProgramDetail.tsx` in the V1 repository, `usmankhan4001/nearby-dora-quran`.

## Deliverables

1. **Read-only exporters** for the live Supabase venues table and the Neon registrations and WhatsApp subscribers tables. The owner supplies connection details at run time through the environment. Nothing is committed, and the scripts open read-only connections.
2. **Cleaning rules.** Deduplicate venues, normalise phone numbers to E.164 (+92), validate coordinates, and flag rows that need a human decision instead of guessing.
3. **Place mapping.** A reviewed CSV that maps each venue to a province, city and area. The script proposes a mapping from address text and coordinates; a human approves it before import.
4. **Import** into the V2 schema: venues, and registrations into `legacy_registrations` tagged Ramadan 2026. WhatsApp subscribers go into `legacy_whatsapp_subscribers` marked as needing re-consent. Registrations are not turned into accounts. Push subscriptions are not migrated.
5. **Dry run by default.** Every command reports what it would do and writes nothing unless `--apply` is given. Imports are idempotent.
6. **Per-city report.** Counts of venues, sessions and legacy registrations per city, rows flagged, and rows skipped with the reason, as a file the owner can read.
7. **Verification script** that compares counts before and after.

## Definition of done

- A dry run on a synthetic fixture and, with the owner's supervision, on a real export produces the per-city report.
- Re-running the import changes nothing.
- No personal data in the repository, in logs, in test fixtures or in the report's committed samples. Fixtures are synthetic.
- A human has reviewed the mapping CSV and the report and approved the apply.

## Commands that must pass

```sh
pnpm check
pnpm --filter @qc/migration test
```

## Decisions to respect

Past registrations keep their original purpose: contact people only for it unless they opt in. WhatsApp subscribers must opt in again. Treat V1's exported data as possibly seen by others, because the V1 database password was exposed in the app. Nothing is rotated until V2 launch.

## Stand-ins

No live access yet: build and test on synthetic data shaped like V1's tables. Place mapping not available: output the proposed mapping as a CSV and stop for review.
