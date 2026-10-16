# 0004: V1 to V2 migration approach

Status: proposed
Date: 2026-10-16
Lane: data-migration

## Context

V1's venues, registrations and WhatsApp subscribers must reach V2 without turning registrants into accounts, without inventing places, and without personal data leaking into logs, reports or the repository. V1's database password was exposed, so exports are treated as sensitive. The V2 legacy tables have no unique key on a subscriber's phone, and the V2 city list is seeded elsewhere.

## Options

Approval and safety:

1. Dry run, then apply with a flag.
2. Dry run prints a fingerprint of the reviewed plan, and apply requires it.

Rows that cannot be placed (unmapped or ambiguous venue, invalid phone):

1. Import with a null or default value.
2. Skip, count by reason, and list the row number and reason in a flagged CSV.

Place mapping:

1. Create cities and areas from V1 text.
2. A person approves a proposed CSV; cities are never created, areas only with `--create-areas`.

## Decision

- **Approval gate:** option 2. The fingerprint is a hash of the report counts and the input-file digests. A mismatch rolls back and does not reveal the expected value.
- **One code path:** the dry run and the apply build the same plan inside one transaction (`BEGIN READ ONLY` or `BEGIN` with an advisory lock). Apply inserts with `ON CONFLICT DO NOTHING` and rolls back if the inserted count differs from the planned count. That makes the apply idempotent and the dry-run counts equal to the apply counts.
- **Unplaceable rows:** option 2. Registrations with an unmapped, ambiguous or unapproved venue are skipped and counted, not invented. Rows with an invalid phone are skipped. International numbers are kept only with an explicit `+` or `00`.
- **Place mapping:** option 2. Only approved rows are used. A province mismatch, bad coordinates and a slug conflict are flagged. Coordinates in the CSV override V1's.
- **Stored values:** `phone_raw` holds the E.164 number in both legacy tables (the original answers, minus name and phone, go in `raw`). Urdu text columns are filled with the English text and counted as `needsUrduText`, because V1 had no Urdu.
- **Deduplication:** registrations by E.164 phone plus normalised venue name (earliest kept); venues by normalised name plus the same address or within 100 m (earliest kept); subscribers by phone, because the table has no unique key (see the change request).
- **Existing V2 data is never overwritten.** A venue present in V2 is recognised by city, normalised name and normalised address.
- **No personal data out:** the report is a strict Zod schema of counts. Failures print only SQLSTATE code, table, constraint or a system error code. Exports are written with mode 0600 in a 0700 folder under the git-ignored `out/`.
- **Read-only V1 access:** explicit column lists, read-only transactions, GET-only REST, and the push subscription table is never touched.

## Consequences

- Easier: the owner reviews one mapping CSV and one counts report, and a second apply is harmless.
- Harder: skipping unmapped registrations means some past registrants are not carried until their venue is mapped and the tool is re-run (re-running is safe).
- To revisit: the legacy subscriber uniqueness and per-city re-consent columns (change request 2026-10-16-legacy-subscriber-keys), and where the bookmark helper lives (change request 2026-10-16-bookmark-import-home).
- The decisions index `README.md` is not edited by this lane.
